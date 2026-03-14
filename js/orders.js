// =============================================
// orders.js — 訂單管理模組
// =============================================

(async function () {
    let currentStoreId = null;
    let allOrders = [];
    let currentFilter = 'all';
    let realtimeChannel = null;
    let isFirstLoad = true;

    // 狀態設定
    const STATUS_CONFIG = {
        pending: { label: '未付款', icon: 'banknote', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', pulse: true },
        confirmed: { label: '已確認', icon: 'check', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', pulse: false },
        preparing: { label: '製作中', icon: 'flame', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', pulse: true },
        ready: { label: '可取餐', icon: 'bell', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', pulse: false },
        completed: { label: '已完成', icon: 'check-circle', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', pulse: false },
        cancelled: { label: '已取消', icon: 'x-circle', bg: 'bg-red-50', text: 'text-red-400', border: 'border-red-100', pulse: false },
    };

    // 下一步狀態流程
    const NEXT_STATUS = {
        pending: { status: 'preparing', label: '確認並製作' },
        preparing: { status: 'ready', label: '製作完成' },
        ready: { status: 'completed', label: '完成取餐' },
    };

    // 共用：渲染客製化選項（琥珀色，與備註同色系）
    function renderItemOptions(options) {
        if (!options || typeof options !== 'object' || Object.keys(options).length === 0) return '';
        const parts = Object.values(options).map(opt => {
            if (opt.type === 'text') return `${opt.label}：${opt.value || ''}`;
            const choices = (opt.choices || []).map(c => c.label).join('、');
            return choices ? `${opt.label}：${choices}` : null;
        }).filter(Boolean);
        if (!parts.length) return '';
        return parts.map(p =>
            `<span class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-0.5 font-medium">${p}</span>`
        ).join(' ');
    }

    async function getStoreId() {
        if (currentStoreId) return currentStoreId;
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return null;
        const { data: store } = await window.supabaseClient.from('stores').select('id').eq('owner_id', user.id).single();
        if (store) currentStoreId = store.id;
        return currentStoreId;
    }

    // =============================================
    // 載入訂單
    // =============================================
    window.loadOrders = async function () {
        const storeId = await getStoreId();
        if (!storeId) return;

        const today = new Date();
        document.getElementById('orders-date-label').textContent =
            `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()} 的訂單`;

        const { data: orders, error } = await window.supabaseClient
            .from('orders')
            .select('id, store_id, table_name, status, total_price, payment_method, is_paid, note, daily_number, created_at, order_items(product_name, quantity, subtotal, options)')
            .eq('store_id', storeId)
            .gte('created_at', new Date(today.setHours(0, 0, 0, 0)).toISOString())
            .order('created_at', { ascending: false });

        if (error) { console.error(error); return; }

        allOrders = orders || [];
        renderOrders();

        if (isFirstLoad) {
            isFirstLoad = false;
            subscribeRealtime(storeId);
        }
    };

    // =============================================
    // 渲染訂單列表 (老闆版)
    // =============================================
    function renderOrders() {
        const list = document.getElementById('orders-list');
        const empty = document.getElementById('orders-empty');
        const loading = document.getElementById('orders-loading');

        loading.classList.add('hidden');

        const filtered = currentFilter === 'all'
            ? allOrders
            : allOrders.filter(o => o.status === currentFilter);

        if (filtered.length === 0) {
            list.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');
        list.classList.remove('hidden');

        list.innerHTML = filtered.map(order => renderOrderCard(order)).join('');
        lucide.createIcons();

        // 綁定按鈕事件
        list.querySelectorAll('.btn-view-detail').forEach(btn => {
            btn.addEventListener('click', () => openDetail(btn.dataset.id));
        });

        // 🌟 統一的動作按鈕監聽器
        list.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === 'pay_and_prepare') {
                    markPaidAndPrepare(id);
                } else if (action === 'next_status') {
                    updateStatus(id, btn.dataset.next);
                }
            });
        });

        // 取消按鈕
        list.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const label = btn.innerText.includes('拒絕') ? '拒絕接單' : '取消訂單';
                const ok = await window.AppDialog.confirm(`確定要${label}嗎？此操作無法復原。`, 'danger', label);
                if (!ok) return;
                updateStatus(btn.dataset.id, 'cancelled');
            });
        });
    }

    function renderOrderCard(order) {
        const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
        const next = NEXT_STATUS[order.status];
        const num = String(order.daily_number || 0).padStart(3, '0');
        const time = new Date(order.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
        const items = order.order_items || [];
        const isPaid = order.is_paid;
        const pay = { cash: '現金', card: '刷卡', linepay: 'Line Pay' }[order.payment_method] || '現金';

        const isCompleted = ['completed', 'cancelled'].includes(order.status);
        const canCancel = !isCompleted;
        const cancelLabel = order.status === 'pending' ? '拒絕接單' : '取消訂單';

        // 🌟 組合主要動作按鈕：調淺顏色(gray-700)，加入綠色圖示點綴
        let actionBtnHtml = '';
        if (order.status === 'pending') {
            actionBtnHtml = `<button class="action-btn flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-800 text-white font-bold text-sm transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-sm" data-id="${order.id}" data-action="pay_and_prepare">
                <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i> 確認收款並製作
            </button>`;
        } else if (next) {
            actionBtnHtml = `<button class="action-btn flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-800 text-white font-bold text-sm transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-sm" data-id="${order.id}" data-action="next_status" data-next="${next.status}">
                <i data-lucide="arrow-right" class="w-4 h-4 text-emerald-400"></i> ${next.label}
            </button>`;
        }

        return `
        <div class="bg-white rounded-2xl border ${order.status === 'pending' ? 'border-amber-200 shadow-amber-50' : order.status === 'cancelled' ? 'border-red-100' : 'border-gray-100'} shadow-sm flex flex-col transition-all hover:shadow-md mb-4 ${isCompleted ? 'opacity-60' : ''}">

            <div class="px-5 py-4 border-b border-gray-50 bg-gray-50/30 rounded-t-2xl flex items-start justify-between">
                <div class="flex items-center gap-4">
                    <div class="text-center">
                        <div class="font-black text-2xl text-gray-800 leading-none">#${num}</div>
                        <div class="text-xs text-gray-400 mt-1">${time}</div>
                    </div>
                    <div class="w-px h-10 bg-gray-200"></div>
                    <div>
                        <div class="font-black text-gray-800 text-lg leading-tight">${order.table_name}</div>
                        <div class="text-[10px] text-gray-500 mt-1">${pay}</div>
                    </div>
                </div>
                
                <div class="flex flex-col items-end gap-2 shrink-0">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${s.bg} ${s.text} border ${s.border} text-xs font-bold ${s.pulse && !isCompleted ? 'animate-pulse' : ''}">
                        <i data-lucide="${s.icon}" class="w-3.5 h-3.5"></i> ${s.label}
                    </span>
                    <button class="btn-view-detail p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" data-id="${order.id}" title="查看明細">
                        <i data-lucide="list" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <div class="px-5 py-4">
                <div class="space-y-3">
                    ${items.map(item => {
            const optHtml = typeof renderItemOptions === 'function' ? renderItemOptions(item.options) : '';
            return `
                    <div class="text-sm">
                        <div class="flex items-center justify-between">
                            <span class="text-gray-700 font-bold">${item.product_name}</span>
                            <div class="flex items-center gap-3 shrink-0 ml-3">
                                <span class="text-gray-400 font-mono text-xs">×${item.quantity}</span>
                                <span class="font-bold text-gray-700 w-16 text-right text-xs">NT$${item.subtotal.toLocaleString()}</span>
                            </div>
                        </div>
                        ${optHtml ? `<div class="flex flex-wrap gap-1 mt-1.5">${optHtml}</div>` : ''}
                    </div>`;
        }).join('')}
                </div>

                <div class="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between flex-wrap gap-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        ${order.note ? `<span class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-0.5 font-medium">📝 ${order.note}</span>` : ''}
                        ${isPaid ? `<span class="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">✓ 已付款</span>` : ''}
                    </div>
                    <span class="font-black text-gray-800 text-base shrink-0">NT$ ${(order.total_price || 0).toLocaleString()}</span>
                </div>
            </div>

            ${(!isCompleted) ? `
            <div class="px-5 py-4 flex gap-3 border-t border-gray-50 bg-white rounded-b-2xl">
                ${canCancel ? `
                <button class="cancel-btn px-4 py-3 rounded-xl bg-white hover:bg-red-50 text-red-500 font-bold text-sm transition-colors border border-red-100 flex items-center justify-center gap-1.5 shadow-sm shrink-0" data-id="${order.id}">
                    <i data-lucide="x-circle" class="w-4 h-4"></i> ${cancelLabel}
                </button>` : ''}
                ${actionBtnHtml}
            </div>` : ''}
        </div>`;
    }

    async function updateStatus(orderId, newStatus) {
        const order = allOrders.find(o => o.id === orderId);
        if (order) order.status = newStatus;
        renderOrders(); // 立即更新畫面 (不會閃爍)
        await window.supabaseClient.from('orders')
            .update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
    }

    // 🌟 合併付款與製作的函數
    async function markPaidAndPrepare(orderId) {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;
        order.is_paid = true;
        order.status = 'preparing';
        renderOrders(); // 立即更新畫面
        await window.supabaseClient.from('orders')
            .update({ is_paid: true, status: 'preparing', updated_at: new Date().toISOString() }).eq('id', orderId);
    }

    // =============================================
    // 訂單明細 Modal
    // =============================================
    function openDetail(orderId) {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;

        const modal = document.getElementById('modal-order-detail');
        const content = document.getElementById('modal-order-detail-content');
        const num = String(order.daily_number || 0).padStart(3, '0');
        const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
        const items = order.order_items || [];
        const next = NEXT_STATUS[order.status];
        const payLabel = { cash: '現金', card: '刷卡', linepay: 'Line Pay' }[order.payment_method] || '現金';

        document.getElementById('detail-title').textContent = `訂單 #${num} — ${order.table_name}`;

        document.getElementById('detail-body').innerHTML = `
            <!-- 狀態 -->
            <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-gray-600">目前狀態</span>
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${s.bg} ${s.text} border ${s.border} text-xs font-bold">
                    <i data-lucide="${s.icon}" class="w-3.5 h-3.5"></i> ${s.label}
                </span>
            </div>

            <!-- 資訊列 -->
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="bg-gray-50 rounded-xl p-3">
                    <p class="text-xs text-gray-400 mb-0.5">點餐時間</p>
                    <p class="font-bold text-gray-700">${new Date(order.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div class="bg-gray-50 rounded-xl p-3">
                    <p class="text-xs text-gray-400 mb-0.5">付款方式</p>
                    <p class="font-bold text-gray-700">${payLabel}</p>
                </div>
            </div>

            ${order.note ? `<div class="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800"><span class="font-bold">備註：</span>${order.note}</div>` : ''}

            <!-- 餐點明細（含客製化選項） -->
            <div>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">餐點明細</p>
                <div class="space-y-3">
                    ${items.map(item => {
            const optHtml = renderItemOptions(item.options);
            return `
                    <div class="py-2 border-b border-gray-50 last:border-0">
                        <div class="flex items-center justify-between text-sm">
                            <span class="font-medium text-gray-700">${item.product_name}</span>
                            <div class="flex items-center gap-4 shrink-0">
                                <span class="text-gray-400 font-mono">×${item.quantity}</span>
                                <span class="font-bold text-gray-800 w-20 text-right">NT$ ${item.subtotal.toLocaleString()}</span>
                            </div>
                        </div>
                        ${optHtml ? `<div class="flex flex-wrap gap-1 mt-1.5">${optHtml}</div>` : ''}
                    </div>`;
        }).join('')}
                </div>
                <div class="flex justify-between items-center pt-3 mt-2 border-t border-gray-200">
                    <span class="font-bold text-gray-700">合計</span>
                    <span class="font-black text-xl text-gray-800">NT$ ${order.total_price.toLocaleString()}</span>
                </div>
            </div>`;

        // Footer 按鈕
        const footer = document.getElementById('detail-footer');
        footer.innerHTML = '';

        // 取消訂單（已完成、已取消以外的狀態都可取消）
        const canCancel = !['completed', 'cancelled'].includes(order.status);
        if (canCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'flex-1 py-2.5 rounded-xl border-2 border-red-200 text-red-500 font-bold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2 active:scale-95';
            const cancelLabel = order.status === 'pending' ? '拒絕接單' : '取消訂單';
            cancelBtn.innerHTML = `<i data-lucide="x-circle" class="w-4 h-4"></i> ${cancelLabel}`;
            cancelBtn.onclick = async () => {
                const ok = await window.AppDialog.confirm(`確定要${cancelLabel}嗎？此操作無法復原。`, 'danger', cancelLabel);
                if (!ok) return;
                await updateStatus(orderId, 'cancelled');
                closeDetail();
            };
            footer.appendChild(cancelBtn);
        }

        // 付款標記
        if (!order.is_paid && order.status !== 'cancelled') {
            const paidBtn = document.createElement('button');
            paidBtn.className = 'flex-1 py-2.5 rounded-xl border-2 border-emerald-500 text-emerald-600 font-bold text-sm hover:bg-emerald-50 transition-all flex items-center justify-center gap-2';
            paidBtn.innerHTML = '<i data-lucide="banknote" class="w-4 h-4"></i> 標記已付款';
            paidBtn.onclick = async () => {
                order.is_paid = true;
                order.status = 'preparing';
                await window.supabaseClient.from('orders').update({
                    is_paid: true,
                    status: 'preparing',
                    updated_at: new Date().toISOString()
                }).eq('id', orderId);
                renderOrders();
                openDetail(orderId);
            };
            footer.appendChild(paidBtn);
        }

        // 推進狀態
        if (next) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95';
            nextBtn.innerHTML = `<i data-lucide="arrow-right" class="w-4 h-4"></i> ${next.label}`;
            nextBtn.onclick = async () => {
                await updateStatus(orderId, next.status);
                openDetail(orderId);
            };
            footer.appendChild(nextBtn);
        }

        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95', 'opacity-0');
        });
        lucide.createIcons();
    }

    function closeDetail() {
        const modal = document.getElementById('modal-order-detail');
        const content = document.getElementById('modal-order-detail-content');
        modal.classList.add('opacity-0');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    document.getElementById('btn-close-detail')?.addEventListener('click', closeDetail);
    document.getElementById('modal-order-detail')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeDetail();
    });

    // =============================================
    // 篩選按鈕
    // =============================================
    document.querySelectorAll('.order-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.status;
            renderOrders();
        });
    });

    // =============================================
    // Realtime 即時通知
    // =============================================
    function subscribeRealtime(storeId) {
        if (realtimeChannel) realtimeChannel.unsubscribe();

        realtimeChannel = window.supabaseClient
            .channel('orders-realtime-' + storeId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'orders',
                filter: `store_id=eq.${storeId}`
            }, async (payload) => {
                const { data: newOrder } = await window.supabaseClient
                    .from('orders')
                    .select('id, store_id, table_name, status, total_price, payment_method, is_paid, note, daily_number, created_at, order_items(product_name, quantity, subtotal, options)')
                    .eq('id', payload.new.id)
                    .single();

                if (newOrder) {
                    allOrders.unshift(newOrder);
                    renderOrders();

                    if (typeof window.playNotification === 'function') window.playNotification();

                    const badge = document.getElementById('orders-new-badge');
                    badge?.classList.remove('hidden');
                    setTimeout(() => badge?.classList.add('hidden'), 5000);

                    const navOrders = document.querySelector('[data-target="section-orders"]');
                    navOrders?.classList.add('text-red-500');
                    setTimeout(() => navOrders?.classList.remove('text-red-500'), 5000);

                    if (typeof window.notifyNewOrder === 'function') window.notifyNewOrder(newOrder);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `store_id=eq.${storeId}`
            }, (payload) => {
                const idx = allOrders.findIndex(o => o.id === payload.new.id);
                if (idx !== -1) allOrders[idx] = { ...allOrders[idx], ...payload.new };
                renderOrders();
            })
            .subscribe();
    }

})();

// playNotification 統一由 dashboard.html 內的 <script> 定義，此處不重複覆蓋