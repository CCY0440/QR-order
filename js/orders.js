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

        // 更新日期標籤
        const today = new Date();
        document.getElementById('orders-date-label').textContent =
            `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()} 的訂單`;

        const { data: orders, error } = await window.supabaseClient
            .from('orders')
            .select('id, store_id, table_name, status, total_price, payment_method, is_paid, note, daily_number, created_at, order_items(product_name, quantity, subtotal)')
            .eq('store_id', storeId)
            .gte('created_at', new Date(today.setHours(0, 0, 0, 0)).toISOString())
            .order('created_at', { ascending: false });

        if (error) { console.error(error); return; }

        allOrders = orders || [];
        renderOrders();

        // 啟動 Realtime（只做一次）
        if (isFirstLoad) {
            isFirstLoad = false;
            subscribeRealtime(storeId);
        }
    };

    // =============================================
    // 渲染訂單列表
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

        // 綁定卡片事件
        list.querySelectorAll('.btn-view-detail').forEach(btn => {
            btn.addEventListener('click', () => openDetail(btn.dataset.id));
        });
        list.querySelectorAll('.btn-next-status').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                updateStatus(btn.dataset.id, btn.dataset.next);
            });
        });
    }

    function renderOrderCard(order) {
        const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
        const next = NEXT_STATUS[order.status];
        const num = String(order.daily_number || 0).padStart(3, '0');
        const time = new Date(order.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
        const items = order.order_items || [];
        const summary = items.slice(0, 2).map(i => `${i.product_name} x${i.quantity}`).join('、');
        const more = items.length > 2 ? `…等 ${items.length} 項` : '';
        const isPaid = order.is_paid;

        return `
        <div class="fade-in bg-white rounded-2xl border ${order.status === 'pending' ? 'border-amber-200 shadow-amber-50' : 'border-gray-100'} shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:shadow-md">

            <!-- 左：訂單號 + 桌號 -->
            <div class="flex items-center gap-4 shrink-0">
                <div class="text-center">
                    <div class="font-black text-2xl text-gray-800 leading-none">#${num}</div>
                    <div class="text-xs text-gray-400 mt-1">${time}</div>
                </div>
                <div class="w-px h-10 bg-gray-100"></div>
                <div class="text-center">
                    <div class="text-xs text-gray-400 mb-0.5">桌號</div>
                    <div class="font-black text-gray-700 text-sm">${order.table_name}</div>
                </div>
            </div>

            <!-- 中：餐點摘要 + 金額 -->
            <div class="flex-1 min-w-0">
                <p class="text-sm text-gray-700 font-medium truncate">${summary}${more}</p>
                <div class="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span class="font-black text-gray-800">NT$ ${order.total_price.toLocaleString()}</span>
                    ${order.note ? `<span class="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg truncate max-w-[180px]" title="${order.note}">📝 ${order.note}</span>` : ''}
                    ${isPaid ? `<span class="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">✓ 已付款</span>` : ''}
                </div>
            </div>

            <!-- 右：狀態 + 操作 -->
            <div class="flex items-center gap-2 shrink-0 flex-wrap">
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${s.bg} ${s.text} border ${s.border} text-xs font-bold ${s.pulse ? 'animate-pulse' : ''}">
                    <i data-lucide="${s.icon}" class="w-3.5 h-3.5"></i> ${s.label}
                </span>
                ${next ? `<button class="btn-next-status text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-all active:scale-95"
                    data-id="${order.id}" data-next="${next.status}">${next.label} →</button>` : ''}
                <button class="btn-view-detail p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" data-id="${order.id}">
                    <i data-lucide="list" class="w-4 h-4"></i>
                </button>
            </div>
        </div>`;
    }

    // =============================================
    // 更新狀態
    // =============================================
    async function updateStatus(orderId, newStatus) {
        // 樂觀更新
        const order = allOrders.find(o => o.id === orderId);
        if (order) order.status = newStatus;
        renderOrders();

        await window.supabaseClient
            .from('orders')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId);
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

            <!-- 餐點明細 -->
            <div>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">餐點明細</p>
                <div class="space-y-2">
                    ${items.map(item => `
                    <div class="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                        <span class="font-medium text-gray-700">${item.product_name}</span>
                        <div class="flex items-center gap-4 shrink-0">
                            <span class="text-gray-400 font-mono">x${item.quantity}</span>
                            <span class="font-bold text-gray-800 w-20 text-right">NT$ ${item.subtotal.toLocaleString()}</span>
                        </div>
                    </div>`).join('')}
                </div>
                <div class="flex justify-between items-center pt-3 mt-2 border-t border-gray-200">
                    <span class="font-bold text-gray-700">合計</span>
                    <span class="font-black text-xl text-gray-800">NT$ ${order.total_price.toLocaleString()}</span>
                </div>
            </div>`;

        // Footer 按鈕
        const footer = document.getElementById('detail-footer');
        footer.innerHTML = '';

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

        // 顯示 Modal
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
                const { data: newOrder } = await window.supabaseClient // ... (省略原本的)

                if (newOrder) {
                    allOrders.unshift(newOrder);
                    renderOrders();

                    // 💡 在這裡呼叫音效與鈴鐺！
                    window.playNotification();

                    // 訂單動態徽章
                    const badge = document.getElementById('orders-new-badge');
                    badge?.classList.remove('hidden');
                    setTimeout(() => badge?.classList.add('hidden'), 5000);

                    // 側邊欄閃爍
                    const navOrders = document.querySelector('[data-target="section-orders"]');
                    navOrders?.classList.add('text-red-500');
                    setTimeout(() => navOrders?.classList.remove('text-red-500'), 5000);

                    // 通知鈴鐺
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