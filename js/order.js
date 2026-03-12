// js/order.js
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // =============================================
    // 1. 解析網址參數
    // =============================================
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('store_id');
    const tableName = urlParams.get('table') || '未指定桌號';

    if (!storeId) {
        document.getElementById('menu-container').innerHTML =
            '<p class="text-center text-red-500 font-bold py-20">無效的點餐網址，找不到店家 ID。</p>';
        return;
    }

    document.getElementById('table-name').textContent = tableName;

    let allProducts = [];
    let cart = {}; // { productId: quantity }

    // =============================================
    // 2. 載入店家資訊 & 菜單
    // =============================================
    try {
        const { data: store } = await window.supabaseClient
            .from('stores')
            .select('name, logo_url, is_open')
            .eq('id', storeId)
            .single();

        if (store) {
            document.getElementById('store-name').textContent = store.name;
            if (store.logo_url) {
                const logoImg = document.getElementById('store-logo');
                logoImg.src = store.logo_url;
                logoImg.classList.remove('hidden');
                document.getElementById('store-logo-fallback').classList.add('hidden');
            }

            // 店家休息中 → 顯示全頁提示，停止載入
            if (store.is_open === false) {
                document.getElementById('menu-container').innerHTML = '';
                document.getElementById('category-nav')?.classList.add('hidden');
                document.getElementById('cart-bar')?.classList.add('hidden');
                document.querySelector('main')?.insertAdjacentHTML('beforeend', `
                    <div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm px-6 text-center">
                        <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                            <i data-lucide="moon" class="w-10 h-10 text-gray-400"></i>
                        </div>
                        <h2 class="text-2xl font-black text-gray-800 mb-2">${store.name}</h2>
                        <p class="text-lg font-bold text-gray-500 mb-1">目前暫停營業中</p>
                        <p class="text-sm text-gray-400">請稍後再來，或洽詢服務人員</p>
                    </div>`);
                if (typeof lucide !== 'undefined') lucide.createIcons();
                return;
            }
        }

        const { data: products, error } = await window.supabaseClient
            .from('products')
            .select('*, categories(name)')
            .eq('store_id', storeId)
            .eq('is_available', true);

        if (error) throw error;
        allProducts = products || [];

        if (allProducts.length === 0) {
            document.getElementById('menu-container').innerHTML =
                '<p class="text-center text-gray-400 font-bold py-20">店家目前尚未供應任何餐點</p>';
            return;
        }

        // 依分類整理
        const groupedProducts = allProducts.reduce((acc, p) => {
            const catName = p.categories ? p.categories.name : '未分類';
            if (!acc[catName]) acc[catName] = [];
            acc[catName].push(p);
            return acc;
        }, {});

        // 渲染分類導覽
        const categoryNav = document.getElementById('category-nav');
        categoryNav.innerHTML = '';
        Object.keys(groupedProducts).forEach((catName, index) => {
            const btn = document.createElement('a');
            btn.href = `#cat-${index}`;
            btn.className = "px-4 py-1.5 whitespace-nowrap rounded-full font-bold text-sm bg-gray-50 text-gray-600 border border-gray-100 hover:bg-emerald-50 hover:text-emerald-600 transition-colors";
            btn.textContent = catName;
            categoryNav.appendChild(btn);
        });

        // 渲染餐點列表
        let menuHtml = '';
        Object.entries(groupedProducts).forEach(([catName, items], index) => {
            menuHtml += `<div id="cat-${index}" class="pt-6 pb-2">
                <h2 class="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                    <span class="w-1 h-5 bg-emerald-500 rounded-full"></span>${catName}
                </h2>
                <div class="space-y-4">`;

            items.forEach(p => {
                const imgHtml = p.image_url
                    ? `<img src="${p.image_url}" class="w-24 h-24 object-cover rounded-xl shrink-0 border border-gray-100">`
                    : `<div class="w-24 h-24 bg-gray-50 rounded-xl shrink-0 flex items-center justify-center border border-gray-100"><i data-lucide="utensils" class="w-8 h-8 text-gray-300"></i></div>`;

                const descHtml = p.description
                    ? `<p class="text-xs text-gray-400 mt-1 line-clamp-2">${p.description}</p>` : '';

                menuHtml += `
                    <div class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-4 fade-in">
                        ${imgHtml}
                        <div class="flex-1 flex flex-col justify-between py-1">
                            <div>
                                <h3 class="font-bold text-gray-800 leading-tight">${p.name}</h3>
                                ${descHtml}
                            </div>
                            <div class="flex justify-between items-end mt-2">
                                <span class="font-black text-gray-800 text-lg">NT$ ${p.price}</span>
                                <div class="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-100">
                                    <button class="w-7 h-7 flex items-center justify-center rounded-md bg-white text-gray-500 shadow-sm active:scale-95 btn-minus" data-id="${p.id}">
                                        <i data-lucide="minus" class="w-4 h-4"></i>
                                    </button>
                                    <span class="font-bold text-gray-800 text-sm w-4 text-center qty-display" id="qty-${p.id}">0</span>
                                    <button class="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-500 text-white shadow-sm active:scale-95 btn-plus" data-id="${p.id}">
                                        <i data-lucide="plus" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>`;
            });
            menuHtml += `</div></div>`;
        });

        document.getElementById('menu-container').innerHTML = menuHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // 綁定購物車按鈕
        document.querySelectorAll('.btn-plus').forEach(btn => {
            btn.addEventListener('click', () => updateCart(btn.dataset.id, 1));
        });
        document.querySelectorAll('.btn-minus').forEach(btn => {
            btn.addEventListener('click', () => updateCart(btn.dataset.id, -1));
        });

    } catch (err) {
        console.error(err);
        document.getElementById('menu-container').innerHTML =
            '<p class="text-center text-red-500 font-bold py-20">載入失敗，請重新整理。</p>';
    }

    // =============================================
    // 3. 購物車邏輯
    // =============================================
    function updateCart(productId, change) {
        if (!cart[productId]) cart[productId] = 0;
        cart[productId] = Math.max(0, cart[productId] + change);

        const qtyEl = document.getElementById(`qty-${productId}`);
        if (qtyEl) qtyEl.textContent = cart[productId];

        let totalCount = 0, totalPrice = 0;
        Object.entries(cart).forEach(([id, qty]) => {
            if (qty > 0) {
                totalCount += qty;
                const product = allProducts.find(p => p.id === id);
                if (product) totalPrice += product.price * qty;
            }
        });

        document.getElementById('cart-count').textContent = totalCount;
        document.getElementById('cart-total').textContent = totalPrice.toLocaleString();

        const cartBar = document.getElementById('cart-bar');
        totalCount > 0
            ? cartBar.classList.remove('translate-y-full')
            : cartBar.classList.add('translate-y-full');
    }

    // =============================================
    // 4. 結帳流程 - 顯示確認 Modal
    // =============================================
    document.getElementById('btn-checkout').addEventListener('click', () => {
        const cartItems = Object.entries(cart)
            .filter(([, qty]) => qty > 0)
            .map(([id, qty]) => {
                const product = allProducts.find(p => p.id === id);
                return { ...product, qty };
            });

        if (cartItems.length === 0) return;

        const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

        // 組出訂單明細 HTML
        let itemsHtml = cartItems.map(item => `
            <div class="flex justify-between items-center py-2.5 border-b border-gray-50 last:border-0">
                <div class="flex items-center gap-3">
                    <span class="w-6 h-6 bg-emerald-100 text-emerald-600 text-xs font-black rounded-full flex items-center justify-center shrink-0">${item.qty}</span>
                    <span class="font-bold text-gray-800 text-sm">${item.name}</span>
                </div>
                <span class="font-bold text-gray-700 text-sm">NT$ ${(item.price * item.qty).toLocaleString()}</span>
            </div>`).join('');

        document.getElementById('checkout-items').innerHTML = itemsHtml;
        document.getElementById('checkout-total').textContent = totalPrice.toLocaleString();
        document.getElementById('checkout-table').textContent = tableName;

        showModal('checkout-modal');
    });

    // =============================================
    // 5. 送出訂單到 Supabase
    // =============================================
    document.getElementById('btn-confirm-order').addEventListener('click', async () => {
        const cartItems = Object.entries(cart)
            .filter(([, qty]) => qty > 0)
            .map(([id, qty]) => {
                const product = allProducts.find(p => p.id === id);
                return { ...product, qty };
            });

        const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
        const note = document.getElementById('order-note').value.trim();
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'cash';

        const btn = document.getElementById('btn-confirm-order');
        btn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin inline mr-2"></i>送出中...';
        btn.disabled = true;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            // 建立主訂單
            // 計算今日流水號
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const { count } = await window.supabaseClient
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('store_id', storeId)
                .gte('created_at', todayStart.toISOString());
            const dailyNumber = (count || 0) + 1;

            const { data: order, error: orderError } = await window.supabaseClient
                .from('orders')
                .insert({
                    store_id: storeId,
                    table_name: tableName,
                    total_price: totalPrice,
                    note: note || null,
                    status: 'pending',
                    payment_method: paymentMethod,
                    daily_number: dailyNumber
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 建立訂單明細
            const orderItems = cartItems.map(item => ({
                order_id: order.id,
                product_id: item.id,
                product_name: item.name,
                product_price: item.price,
                quantity: item.qty,
                subtotal: item.price * item.qty
            }));

            const { error: itemsError } = await window.supabaseClient
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // 成功 → 隱藏結帳 modal，顯示追蹤頁面
            hideModal('checkout-modal');
            showOrderTracking(order.id, cartItems, totalPrice, note, paymentMethod, order.daily_number || dailyNumber);

            // 清空購物車
            cart = {};
            allProducts.forEach(p => {
                const el = document.getElementById(`qty-${p.id}`);
                if (el) el.textContent = '0';
            });
            document.getElementById('cart-count').textContent = '0';
            document.getElementById('cart-total').textContent = '0';
            document.getElementById('cart-bar').classList.add('translate-y-full');

        } catch (err) {
            console.error('送出訂單失敗:', err);
            alert('送出失敗，請重試：' + err.message);
        } finally {
            btn.innerHTML = '確認送出 <i data-lucide="send" class="w-4 h-4 inline ml-1"></i>';
            btn.disabled = false;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    });

    document.getElementById('btn-cancel-checkout').addEventListener('click', () => hideModal('checkout-modal'));

    // =============================================
    // 6. 訂單追蹤頁面（含 Realtime）
    // =============================================
    let realtimeChannel = null;

    function showOrderTracking(orderId, cartItems, totalPrice, note, paymentMethod = 'cash', dailyNumber = 0) {
        const STATUS_CONFIG = {
            pending: { step: 1, label: '待付款', icon: 'banknote', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
            confirmed: { step: 2, label: '已確認', icon: 'check-circle', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
            preparing: { step: 3, label: '製作中', icon: 'chef-hat', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
            ready: { step: 4, label: '可取餐了', icon: 'bell-ring', color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            completed: { step: 5, label: '用餐愉快', icon: 'star', color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
            cancelled: { step: 0, label: '訂單取消', icon: 'x-circle', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
        };

        const steps = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
        const stepLabels = ['待付款', '已確認', '製作中', '可取餐', '完成'];

        let itemsHtml = cartItems.map(item => `
            <div class="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 text-sm">
                <span class="text-gray-700 font-medium">${item.name} × ${item.qty}</span>
                <span class="font-bold text-gray-800">NT$ ${(item.price * item.qty).toLocaleString()}</span>
            </div>`).join('');

        if (note) {
            itemsHtml += `<div class="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span class="font-bold">備註：</span>${note}</div>`;
        }

        const trackingHtml = `
            <div id="tracking-screen" class="fixed inset-0 z-[100] bg-[#f8fafc] overflow-y-auto">
                <div class="max-w-lg mx-auto px-4 py-8">

                    <!-- Header -->
                    <div class="text-center mb-8">
                        <div class="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-sm font-bold text-gray-600 shadow-sm mb-4">
                            <i data-lucide="map-pin" class="w-4 h-4 text-emerald-500"></i> ${tableName}
                        </div>
                        <h1 class="text-2xl font-black text-gray-800">訂單追蹤</h1>
                        <p class="text-xs text-gray-400 mt-1 font-mono">今日訂單 #${String(dailyNumber).padStart(3, '0')}</p>
                    </div>

                    <!-- 付款提示（現金才顯示） -->
                    ${paymentMethod === 'cash' ? `
                    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
                        <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                            <i data-lucide="banknote" class="w-5 h-5 text-amber-600"></i>
                        </div>
                        <div>
                            <p class="font-black text-amber-800 text-sm mb-0.5">請到櫃檯付款</p>
                            <p class="text-xs text-amber-700 leading-relaxed">結帳時請告知店員您的訂單號</p>
                            <div class="mt-2 bg-white border border-amber-200 rounded-xl px-4 py-2 inline-block">
                                <span class="font-mono font-black text-amber-800 tracking-widest text-2xl">#${String(dailyNumber).padStart(3, '0')}</span>
                            </div>
                        </div>
                    </div>` : ''}

                    <!-- 狀態主卡片 -->
                    <div id="status-card" class="bg-white rounded-3xl shadow-md border border-gray-100 p-6 mb-6 text-center transition-all duration-500">
                        <div id="status-icon-wrap" class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-500 bg-yellow-50 border-2 border-yellow-200">
                            <i id="status-icon" data-lucide="clock" class="w-10 h-10 text-yellow-500"></i>
                        </div>
                        <h2 id="status-label" class="text-2xl font-black text-gray-800 mb-1">待確認</h2>
                        <p id="status-desc" class="text-sm text-gray-500 font-medium">餐廳正在確認您的訂單，請稍候...</p>
                        <div class="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                            <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                            即時更新中
                        </div>
                    </div>

                    <!-- 進度步驟條 -->
                    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-6">
                        <div class="flex items-center justify-between relative">
                            <div class="absolute left-0 right-0 top-4 h-1 bg-gray-100 -z-0 mx-5"></div>
                            <div id="progress-fill" class="absolute left-0 top-4 h-1 bg-emerald-400 -z-0 ml-5 transition-all duration-700 rounded-full" style="width: 0%"></div>
                            ${steps.map((s, i) => `
                                <div class="flex flex-col items-center gap-2 z-10 bg-transparent" id="step-dot-wrap-${i}">
                                    <div id="step-dot-${i}" class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-500 bg-white border-gray-200 text-gray-400">
                                        ${i + 1}
                                    </div>
                                    <span class="text-[10px] font-bold text-gray-400 whitespace-nowrap" id="step-label-${i}">${stepLabels[i]}</span>
                                </div>`).join('')}
                        </div>
                    </div>

                    <!-- 訂單明細 -->
                    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-6">
                        <h3 class="font-black text-gray-800 mb-3 flex items-center gap-2">
                            <i data-lucide="receipt" class="w-4 h-4 text-emerald-500"></i> 訂單明細
                        </h3>
                        ${itemsHtml}
                        <div class="flex justify-between items-center pt-3 mt-1 border-t border-gray-100">
                            <span class="font-bold text-gray-600">總計</span>
                            <span class="text-xl font-black text-gray-800">NT$ ${totalPrice.toLocaleString()}</span>
                        </div>
                    </div>

                    <!-- 繼續點餐按鈕 -->
                    <button id="btn-back-to-menu"
                        class="w-full bg-white border border-gray-200 text-gray-600 font-bold py-4 rounded-2xl hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                        <i data-lucide="plus-circle" class="w-5 h-5 text-emerald-500"></i> 繼續點餐
                    </button>

                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', trackingHtml);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // 更新狀態 UI
        function updateStatusUI(status) {
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
            const currentStep = steps.indexOf(status);

            // 主狀態卡片
            const iconWrap = document.getElementById('status-icon-wrap');
            const icon = document.getElementById('status-icon');
            const label = document.getElementById('status-label');
            const desc = document.getElementById('status-desc');

            iconWrap.className = `w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-500 ${cfg.bg} border-2 ${cfg.border}`;
            icon.setAttribute('data-lucide', cfg.icon);
            icon.className = `w-10 h-10 ${cfg.color}`;
            label.textContent = cfg.label;

            const descs = {
                pending: '請到櫃檯付款，完成後廚房即開始製作',
                confirmed: '付款已確認！廚房馬上開始為您準備 ✅',
                preparing: '廚師正在精心製作您的餐點 🍳',
                ready: '餐點已準備好，服務員即將為您上菜！',
                completed: '感謝您的光臨，用餐愉快！',
                cancelled: '很抱歉，此訂單已被取消，請洽服務員',
            };
            desc.textContent = descs[status] || '';

            // 已確認 → 2.5秒後自動切換顯示「製作中」（狀態可能已是 preparing）
            if (status === 'confirmed') {
                setTimeout(() => {
                    // 若 Realtime 已更新就不重複，否則預先切換 UI
                    if (document.getElementById('status-label')?.textContent === '已確認') {
                        updateStatusUI('preparing');
                    }
                }, 2500);
            }

            // 步驟條
            const progressPercent = currentStep > 0 ? (currentStep / (steps.length - 1)) * 100 : 0;
            const fillEl = document.getElementById('progress-fill');
            if (fillEl) fillEl.style.width = `${progressPercent}%`;

            steps.forEach((s, i) => {
                const dot = document.getElementById(`step-dot-${i}`);
                const lbl = document.getElementById(`step-label-${i}`);
                if (!dot) return;

                if (i < currentStep) {
                    dot.className = 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-500 bg-emerald-500 border-emerald-500 text-white';
                    dot.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
                    lbl.className = 'text-[10px] font-bold text-emerald-500 whitespace-nowrap';
                } else if (i === currentStep) {
                    dot.className = `w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-500 ${cfg.bg} ${cfg.border} ${cfg.color}`;
                    dot.textContent = i + 1;
                    lbl.className = `text-[10px] font-black whitespace-nowrap ${cfg.color}`;
                } else {
                    dot.className = 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-500 bg-white border-gray-200 text-gray-400';
                    dot.textContent = i + 1;
                    lbl.className = 'text-[10px] font-bold text-gray-400 whitespace-nowrap';
                }
            });

            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        // 初始狀態
        updateStatusUI('pending');

        // Realtime 訂閱
        realtimeChannel = window.supabaseClient
            .channel(`order-${orderId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `id=eq.${orderId}`
            }, (payload) => {
                updateStatusUI(payload.new.status);
            })
            .subscribe();

        // 繼續點餐
        document.getElementById('btn-back-to-menu').addEventListener('click', () => {
            if (realtimeChannel) {
                window.supabaseClient.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
            document.getElementById('tracking-screen').remove();
        });
    }

    // =============================================
    // 7. Modal 工具函式
    // =============================================
    function showModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('.modal-card')?.classList.remove('scale-95', 'opacity-0');
        });
    }

    function hideModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('opacity-0');
        modal.querySelector('.modal-card')?.classList.add('scale-95', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
});