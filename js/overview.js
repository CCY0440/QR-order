// =============================================
// overview.js — 總覽大廳即時資料
// =============================================
(async function () {
    const STATUS_CONFIG = {
        pending: { label: '未付款', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: 'banknote', pulse: true },
        confirmed: { label: '已確認', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: 'check', pulse: false },
        preparing: { label: '製作中', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', icon: 'flame', pulse: true },
        ready: { label: '可取餐', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: 'bell', pulse: false },
        completed: { label: '已完成', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', icon: 'check-circle', pulse: false },
    };

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

    let storeId = null;
    let todayOrders = [];

    async function getStoreId() {
        if (storeId) return storeId;
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return null;
        const { data: store } = await window.supabaseClient.from('stores').select('id').eq('owner_id', user.id).single();
        if (store) storeId = store.id;
        return storeId;
    }

    async function loadOverview() {
        const id = await getStoreId();
        if (!id) return;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: orders } = await window.supabaseClient
            .from('orders')
            .select('id, store_id, table_name, status, total_price, payment_method, is_paid, note, daily_number, created_at, order_items(product_name, quantity, subtotal, options)')
            .eq('store_id', id)
            .gte('created_at', todayStart.toISOString())
            .order('created_at', { ascending: false });

        todayOrders = orders || [];
        renderStats();
        renderOrdersList();
        subscribeRealtime(id);
    }

    function renderStats() {
        const completed = todayOrders.filter(o => o.status === 'completed');
        const pending = todayOrders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status));
        const revenue = completed.reduce((s, o) => s + (o.total_price || 0), 0);

        document.getElementById('ov-revenue').textContent = revenue.toLocaleString();
        document.getElementById('ov-completed').textContent = completed.length;
        document.getElementById('ov-total-orders').textContent = todayOrders.length;

        // 🌟 廚房待製作：自動變色邏輯
        const pendingEl = document.getElementById('ov-pending');
        const pendingCard = document.getElementById('ov-pending-card');
        const pendingLabel = document.getElementById('ov-pending-label');
        const pendingUnit = pendingEl ? pendingEl.nextElementSibling : null;

        if (pendingEl) pendingEl.textContent = pending.length;

        if (pendingCard) {
            if (pending.length > 0) {
                // 🔴 有單時：醒目的紅橘色警告
                pendingCard.className = 'bg-red-50 border border-red-100 p-5 rounded-2xl shadow-sm flex flex-col relative overflow-hidden transition-colors duration-300';
                if (pendingLabel) pendingLabel.className = 'text-sm font-bold mb-1 flex items-center gap-1 text-red-600';
                if (pendingEl) pendingEl.className = 'text-3xl font-black tracking-tight text-red-600';
                if (pendingUnit) pendingUnit.className = 'text-sm font-bold text-red-500';
            } else {
                // ⚪ 無單時：正常的白底灰字
                pendingCard.className = 'bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex flex-col relative overflow-hidden transition-colors duration-300';
                if (pendingLabel) pendingLabel.className = 'text-sm font-bold mb-1 flex items-center gap-1 text-gray-500';
                if (pendingEl) pendingEl.className = 'text-3xl font-bold tracking-tight text-gray-800';
                if (pendingUnit) pendingUnit.className = 'text-sm font-bold text-gray-500';
            }
        }
        lucide.createIcons();
    }

    // =============================================
    // 渲染訂單列表 (總覽大廳)
    // =============================================
    function renderOrdersList() {
        const list = document.getElementById('ov-orders-list');
        if (!list) return;

        const active = todayOrders
            .filter(o => o.status !== 'completed' && o.status !== 'cancelled')
            .slice(0, 10);

        if (active.length === 0) {
            list.innerHTML = `<div class="p-8 text-center">
                <i data-lucide="check-circle-2" class="w-8 h-8 mx-auto mb-2 text-gray-200"></i>
                <p class="text-sm font-bold text-gray-400">目前沒有待處理的訂單</p>
            </div>`;
            lucide.createIcons();
            return;
        }

        const payLabel = { cash: '現金', card: '刷卡', linepay: 'Line Pay' };

        list.innerHTML = active.map(order => {
            const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const next = NEXT_STATUS[order.status];
            const num = String(order.daily_number || 0).padStart(3, '0');
            const time = new Date(order.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
            const items = order.order_items || [];
            const pay = payLabel[order.payment_method] || '現金';
            const isPaid = order.is_paid;
            const cancelLabel = order.status === 'pending' ? '拒絕接單' : '取消訂單';
            const canCancel = ['pending', 'confirmed', 'preparing'].includes(order.status);

            // 組合按鈕邏輯
            let actionBtnHtml = '';
            if (order.status === 'pending') {
                actionBtnHtml = `<button class="ov-action-btn flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-800 text-white font-bold text-sm transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-sm" data-id="${order.id}" data-action="pay_and_prepare">
                    <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i> 確認收款並製作
                </button>`;
            } else if (next) {
                actionBtnHtml = `<button class="ov-action-btn flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-800 text-white font-bold text-sm transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-sm" data-id="${order.id}" data-action="next_status" data-next="${next.status}">
                    <i data-lucide="arrow-right" class="w-4 h-4 text-emerald-400"></i> ${next.label}
                </button>`;
            }

            return `
            <div class="bg-white rounded-2xl border ${order.status === 'pending' ? 'border-amber-200 shadow-amber-50' : 'border-gray-100'} shadow-sm flex flex-col transition-all hover:shadow-md mb-4">
                
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
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${s.bg} ${s.text} border ${s.border} text-xs font-bold ${s.pulse ? 'animate-pulse' : ''}">
                            <i data-lucide="${s.icon}" class="w-3.5 h-3.5"></i> ${s.label}
                        </span>
                    </div>
                </div>

                <div class="px-5 py-4">
                    <div class="space-y-3">
                        ${items.map(item => {
                const optHtml = renderItemOptions(item.options);
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

                <div class="px-5 py-4 flex gap-3 border-t border-gray-50 bg-white rounded-b-2xl">
                    ${canCancel ? `
                    <button class="ov-cancel-btn px-4 py-3 rounded-xl bg-white hover:bg-red-50 text-red-500 font-bold text-sm transition-colors border border-red-100 flex items-center justify-center gap-1.5 shadow-sm shrink-0" data-id="${order.id}">
                        <i data-lucide="x-circle" class="w-4 h-4"></i> ${cancelLabel}
                    </button>` : ''}
                    ${actionBtnHtml}
                </div>
            </div>`;
        }).join('');

        lucide.createIcons();

        // 綁定事件
        list.querySelectorAll('.ov-action-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const order = todayOrders.find(o => o.id === btn.dataset.id);
                if (!order) return;

                if (btn.dataset.action === 'pay_and_prepare') {
                    order.is_paid = true;
                    order.status = 'preparing';
                } else {
                    order.status = btn.dataset.next;
                }
                renderStats();
                renderOrdersList();
                await window.supabaseClient.from('orders')
                    .update({ status: order.status, is_paid: order.is_paid, updated_at: new Date().toISOString() })
                    .eq('id', btn.dataset.id);
            });
        });

        list.querySelectorAll('.ov-cancel-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await window.AppDialog.confirm('確定要取消這筆訂單嗎？此操作無法復原。', 'danger', '取消訂單');
                if (!ok) return;
                const order = todayOrders.find(o => o.id === btn.dataset.id);
                if (!order) return;
                order.status = 'cancelled';
                renderStats();
                renderOrdersList();
                await window.supabaseClient.from('orders')
                    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                    .eq('id', btn.dataset.id);
            });
        });
    }

    function subscribeRealtime(id) {
        window.supabaseClient
            .channel('overview-realtime-' + id)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
                async (payload) => {
                    if (payload.new.store_id !== id) return;
                    const { data: full } = await window.supabaseClient
                        .from('orders')
                        .select('id, store_id, table_name, status, total_price, payment_method, is_paid, note, daily_number, created_at, order_items(product_name, quantity, subtotal, options)')
                        .eq('id', payload.new.id)
                        .single();
                    if (full) todayOrders.unshift(full);
                    renderStats();
                    renderOrdersList();

                    if (typeof window.playNotification === 'function') window.playNotification();
                })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
                (payload) => {
                    if (payload.new.store_id !== id) return;
                    const idx = todayOrders.findIndex(o => o.id === payload.new.id);
                    if (idx !== -1) todayOrders[idx] = { ...todayOrders[idx], ...payload.new };
                    renderStats();
                    renderOrdersList();
                })
            .subscribe((status) => {
                console.log('Overview Realtime status:', status);
            });
    }

    window.loadOverview = loadOverview;
    if (document.getElementById('section-overview') && !document.getElementById('section-overview').classList.contains('hidden')) {
        loadOverview();
    }
})();