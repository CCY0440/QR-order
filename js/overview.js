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
            .select('id, store_id, table_name, status, total_price, payment_method, is_paid, note, daily_number, created_at, order_items(product_name, quantity, subtotal)')
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
        // 修改後的寫法 (拔除 'ready')：
        const pending = todayOrders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status));
        const revenue = completed.reduce((s, o) => s + (o.total_price || 0), 0);

        document.getElementById('ov-revenue').textContent = revenue.toLocaleString();
        document.getElementById('ov-completed').textContent = completed.length;
        document.getElementById('ov-total-orders').textContent = todayOrders.length;

        const pendingEl = document.getElementById('ov-pending');
        const pendingCard = document.getElementById('ov-pending-card');
        if (pendingEl) pendingEl.textContent = pending.length;

        if (pendingCard) {
            if (pending.length > 0) {
                pendingCard.className = 'bg-red-50 border border-red-100 p-5 rounded-2xl shadow-sm flex flex-col relative overflow-hidden transition-colors duration-300';
                pendingCard.querySelector('#ov-pending-label').className = 'text-sm font-bold mb-1 flex items-center gap-1 text-red-600';
                pendingEl.className = 'text-3xl font-bold tracking-tight text-red-600';
                pendingCard.querySelector('span:last-of-type') && (pendingCard.querySelectorAll('span')[2].className = 'text-sm font-bold text-red-500');
            } else {
                pendingCard.className = 'bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex flex-col relative overflow-hidden transition-colors duration-300';
                pendingCard.querySelector('#ov-pending-label').className = 'text-sm font-bold mb-1 flex items-center gap-1 text-gray-500';
                if (pendingEl) pendingEl.className = 'text-3xl font-bold tracking-tight text-gray-800';
            }
        }
        lucide.createIcons();
    }

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

            return `
            <div class="fade-in p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">

                <!-- 左：流水號 + 時間 + 桌號 + 付款 -->
                <div class="w-20 shrink-0 flex flex-col gap-1.5">
                    <div class="bg-gray-800 rounded-xl px-2 py-1.5 text-center">
                        <div class="font-black text-lg text-white leading-none">#${num}</div>
                        <div class="text-[10px] text-gray-400 mt-0.5">${time}</div>
                    </div>
                    <div class="bg-gray-50 border border-gray-100 rounded-xl px-2 py-1.5 text-center">
                        <div class="font-black text-gray-800 text-sm leading-tight">${order.table_name}</div>
                        <div class="text-[10px] text-gray-400 mt-0.5">${pay}</div>
                    </div>
                </div>

                <div class="w-px bg-gray-100 self-stretch hidden sm:block shrink-0"></div>

                <!-- 中：餐點明細 -->
                <div class="flex-1 min-w-0">
                    <div class="space-y-1.5">
                        ${items.map(item => `
                        <div class="flex items-center justify-between text-sm">
                            <span class="text-gray-700 font-medium truncate">${item.product_name}</span>
                            <div class="flex items-center gap-3 shrink-0 ml-3">
                                <span class="text-gray-400 font-mono text-xs">×${item.quantity}</span>
                                <span class="font-bold text-gray-700 w-16 text-right text-xs">NT$${item.subtotal.toLocaleString()}</span>
                            </div>
                        </div>`).join('')}
                    </div>
                    <div class="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            ${order.note ? `<span class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-0.5 font-medium">📝 ${order.note}</span>` : ''}
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="text-xs font-bold text-gray-400">${items.length} 項餐點</span>
                            <span class="text-xs text-gray-300">·</span>
                            <span class="text-xs font-bold text-gray-400">×${items.reduce((s, i) => s + i.quantity, 0)}</span>
                            <span class="font-black text-gray-800 text-sm">NT$ ${order.total_price.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <!-- 右：狀態 + 操作 -->
                <div class="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                    <span class="text-xs font-bold px-2.5 py-1.5 rounded-xl ${s.bg} ${s.text} border ${s.border} flex items-center gap-1 ${s.pulse ? 'animate-pulse' : ''}">
                        <i data-lucide="${s.icon}" class="w-3 h-3"></i> ${s.label}
                    </span>
                    ${next ? `<button class="ov-next-btn text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-all active:scale-95 whitespace-nowrap"
                        data-id="${order.id}" data-next="${next.status}">${next.label}</button>` : ''}
                </div>
            </div>`;
        }).join('');

        lucide.createIcons();

        list.querySelectorAll('.ov-next-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const order = todayOrders.find(o => o.id === btn.dataset.id);
                if (!order) return;
                order.status = btn.dataset.next;
                renderStats();
                renderOrdersList();
                await window.supabaseClient
                    .from('orders')
                    .update({ status: btn.dataset.next, updated_at: new Date().toISOString() })
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
                        .select('id, store_id, table_name, status, total_price, payment_method, is_paid, note, daily_number, created_at, order_items(product_name, quantity, subtotal)')
                        .eq('id', payload.new.id)
                        .single();
                    if (full) todayOrders.unshift(full);
                    renderStats();
                    renderOrdersList();

                    // ✅ 加上這行！
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
    // Auto-run when section is already visible on page load
    if (document.getElementById('section-overview') && !document.getElementById('section-overview').classList.contains('hidden')) {
        loadOverview();
    }
})();

// playNotification 統一由 dashboard.html 內的 <script> 定義，此處不重複覆蓋