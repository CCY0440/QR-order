// =============================================
// order.js — 顧客點餐頁（全新版）
// =============================================
(async function () {
    const params = new URLSearchParams(location.search);
    const storeId = params.get('store_id');
    const tableName = decodeURIComponent(params.get('table') || '');

    if (!storeId) {
        document.getElementById('menu-container').innerHTML = '<p class="text-center text-red-500 font-bold py-20">連結無效</p>';
        return;
    }

    // ── 狀態 ──
    let allProducts = [];
    let cart = []; // [{product, qty, options, lineTotal}]
    let currentProduct = null;
    let pmQty = 1;
    let realtimeChannel = null;

    // ── 初始化 ──
    document.getElementById('table-badge').textContent = tableName;

    // 載入店家
    const { data: store } = await window.supabaseClient
        .from('stores').select('name, logo_url, description, is_open').eq('id', storeId).single();

    if (!store) { document.getElementById('menu-container').innerHTML = '<p class="text-center text-gray-500 py-20">找不到店家</p>'; return; }

    document.title = store.name + ' · 點餐';
    document.getElementById('store-name').textContent = store.name;
    document.getElementById('closed-name').textContent = store.name;

    if (store.logo_url) {
        document.getElementById('store-logo').src = store.logo_url;
        document.getElementById('store-logo').classList.remove('hidden');
        document.getElementById('store-logo-fallback').classList.add('hidden');
    }
    if (store.description) {
        document.getElementById('store-desc').textContent = store.description;
        document.getElementById('store-desc-wrap').classList.remove('hidden');
    }
    if (store.is_open === false) {
        document.getElementById('closed-overlay').classList.remove('hidden');
        return;
    }

    await loadMenu();
    subscribeRealtime();
    bindUI();
    lucide.createIcons();

    // ── 1. 載入菜單 ──
    async function loadMenu() {
        try {
            // 分類（不依賴 FK join）
            const { data: categories } = await window.supabaseClient
                .from('categories')
                .select('id, name, sort_order')
                .eq('store_id', storeId)
                .order('sort_order', { ascending: true });
            const catMap = {};
            (categories || []).forEach(c => { catMap[c.id] = c; });

            // 商品
            const { data: products, error } = await window.supabaseClient
                .from('products')
                .select('id, category_id, name, price, description, image_url, is_available')
                .eq('store_id', storeId)
                .eq('is_available', true)
                .order('name');
            if (error) throw error;

            // 客製化選項
            const { data: allOptions } = await window.supabaseClient
                .from('product_options')
                .select('*')
                .eq('store_id', storeId)
                .order('sort_order', { ascending: true });
            const optionsMap = {};
            (allOptions || []).forEach(opt => {
                if (!optionsMap[opt.product_id]) optionsMap[opt.product_id] = [];
                optionsMap[opt.product_id].push(opt);
            });

            // 組合
            allProducts = (products || []).map(p => ({
                ...p,
                categories: catMap[p.category_id] || { name: '其他', sort_order: 99 },
                product_options: optionsMap[p.id] || []
            }));

            // 依 sort_order 分組
            const grouped = {};
            allProducts.forEach(p => {
                const catName = p.categories?.name || '其他';
                if (!grouped[catName]) grouped[catName] = { sort: p.categories?.sort_order ?? 99, items: [] };
                grouped[catName].items.push(p);
            });
            const sortedGroups = Object.entries(grouped).sort((a, b) => a[1].sort - b[1].sort);

            // 分類導覽
            const nav = document.getElementById('category-nav');
            nav.innerHTML = '';
            sortedGroups.forEach(([cat], i) => {
                const btn = document.createElement('button');
                btn.className = 'cat-btn px-4 py-1.5 whitespace-nowrap rounded-full font-bold text-sm bg-white text-gray-600 border border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors';
                btn.textContent = cat;
                btn.dataset.cat = i;
                if (i === 0) btn.classList.add('active');
                btn.onclick = () => {
                    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById(`cat-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                };
                nav.appendChild(btn);
            });

            // 菜單：2欄卡片
            let html = '';
            sortedGroups.forEach(([cat, group], i) => {
                const items = group.items;
                html += `<div id="cat-${i}" class="mb-8 fade-in">
                    <h2 class="text-base font-black text-gray-800 mb-3 flex items-center gap-2">
                        <span class="w-1 h-5 bg-emerald-500 rounded-full inline-block"></span>${cat}
                        <span class="text-xs font-normal text-gray-400">${items.length} 項</span>
                    </h2>
                    <div class="grid grid-cols-2 gap-3">`;
                items.forEach(p => {
                    const hasImg = !!p.image_url;
                    html += `
                    <div class="product-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col" data-id="${p.id}" onclick="openProductModal('${p.id}')">
                        ${hasImg
                            ? `<div class="relative w-full aspect-video overflow-hidden bg-gray-50">
                                <img src="${p.image_url}" class="w-full h-full object-cover" loading="lazy" />
                                <span id="cart-pill-${p.id}" class="hidden absolute top-2 right-2 bg-emerald-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow">0</span>
                               </div>`
                            : `<div class="relative w-full aspect-video bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                                <i data-lucide="utensils" class="w-8 h-8 text-gray-200"></i>
                                <span id="cart-pill-${p.id}" class="hidden absolute top-2 right-2 bg-emerald-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow">0</span>
                               </div>`
                        }
                        <div class="p-3 flex flex-col flex-1">
                            <h3 class="font-bold text-gray-800 text-sm leading-tight">${p.name}</h3>
                            ${p.description ? `<p class="text-xs text-gray-400 mt-1 line-clamp-2">${p.description}</p>` : ''}
                            <div class="mt-auto pt-2 flex items-center justify-between">
                                <span class="font-black text-gray-800">NT$ ${p.price}</span>
                                <div class="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm">
                                    <i data-lucide="plus" class="w-3.5 h-3.5 text-white"></i>
                                </div>
                            </div>
                        </div>
                    </div>`;
                });
                html += `</div></div>`;
            });

            document.getElementById('menu-container').innerHTML = html || '<p class="text-center text-gray-400 py-20">目前沒有供應中的餐點</p>';
            if (typeof lucide !== 'undefined') lucide.createIcons();

        } catch (e) {
            console.error('loadMenu error:', e);
            document.getElementById('menu-container').innerHTML = '<p class="text-center text-red-500 py-20 font-bold">載入失敗，請重新整理</p>';
        }
    }

    // ── 2. 餐點 Modal ──
    window.openProductModal = function (productId) {
        const p = allProducts.find(x => x.id === productId);
        if (!p) return;
        currentProduct = p;
        pmQty = 1;

        document.getElementById('pm-name').textContent = p.name;
        document.getElementById('pm-price').textContent = `NT$ ${p.price}`;
        document.getElementById('pm-desc').textContent = p.description || '';
        document.getElementById('pm-qty').textContent = '1';

        const imgWrap = document.getElementById('pm-img-wrap');
        const img = document.getElementById('pm-img');
        if (p.image_url) {
            img.src = p.image_url;
            imgWrap.classList.remove('hidden');
        } else {
            imgWrap.classList.add('hidden');
        }

        // 客製化選項
        const optContainer = document.getElementById('pm-options');
        const options = p.product_options || [];
        if (options.length === 0) {
            optContainer.innerHTML = '';
        } else {
            optContainer.innerHTML = options.sort((a, b) => a.sort_order - b.sort_order).map(opt => {
                const choices = opt.choices || [];
                if (opt.type === 'text') {
                    return `<div>
                        <label class="block text-sm font-bold text-gray-700 mb-2">${opt.label}${opt.required ? ' <span class="text-red-400">*</span>' : ''}</label>
                        <textarea class="opt-field w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none" rows="2" data-opt-id="${opt.id}" data-opt-label="${opt.label}" data-opt-type="text" placeholder="請輸入..."></textarea>
                    </div>`;
                }
                const isMulti = opt.type === 'multi';
                return `<div>
                    <label class="block text-sm font-bold text-gray-700 mb-2">${opt.label}${opt.required ? ' <span class="text-red-400">*</span>' : ''} <span class="text-xs font-normal text-gray-400">${isMulti ? '（可多選）' : '（單選）'}</span></label>
                    <div class="flex flex-wrap gap-2">
                        ${choices.map((c, ci) => `
                        <label class="flex items-center gap-1.5 px-3 py-2 border-2 rounded-xl cursor-pointer has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 border-gray-200 transition-all">
                            <input type="${isMulti ? 'checkbox' : 'radio'}" name="opt-${opt.id}" value="${ci}" class="opt-field sr-only" data-opt-id="${opt.id}" data-opt-label="${opt.label}" data-opt-type="${opt.type}" data-choice-label="${c.label}" data-choice-price="${c.price || 0}" ${!isMulti && ci === 0 ? 'checked' : ''}>
                            <span class="text-sm font-bold text-gray-700">${c.label}</span>
                            ${c.price ? `<span class="text-xs text-emerald-600 font-bold">+${c.price}</span>` : ''}
                        </label>`).join('')}
                    </div>
                </div>`;
            }).join('');
        }

        // 更新按鈕文字
        updateModalAddBtn();

        document.getElementById('product-modal-backdrop').classList.remove('hidden');
        requestAnimationFrame(() => document.getElementById('product-modal').classList.add('open'));
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    window.closeProductModal = function () {
        document.getElementById('product-modal').classList.remove('open');
        setTimeout(() => document.getElementById('product-modal-backdrop').classList.add('hidden'), 350);
        currentProduct = null;
    };

    function updateModalAddBtn() {
        if (!currentProduct) return;
        const extraPrice = calcOptionsExtra();
        const total = (currentProduct.price + extraPrice) * pmQty;
        document.getElementById('pm-add-btn').textContent = `加入點單 · NT$ ${total}`;
    }

    function calcOptionsExtra() {
        if (!currentProduct) return 0;
        let extra = 0;
        document.querySelectorAll('.opt-field').forEach(el => {
            if (el.type === 'radio' && el.checked) extra += parseInt(el.dataset.choicePrice || 0);
            if (el.type === 'checkbox' && el.checked) extra += parseInt(el.dataset.choicePrice || 0);
        });
        return extra;
    }

    document.getElementById('pm-minus').onclick = () => {
        if (pmQty > 1) { pmQty--; document.getElementById('pm-qty').textContent = pmQty; updateModalAddBtn(); }
    };
    document.getElementById('pm-plus').onclick = () => {
        pmQty++;
        document.getElementById('pm-qty').textContent = pmQty;
        updateModalAddBtn();
    };

    // 選項變動時更新金額
    document.getElementById('pm-options').addEventListener('change', updateModalAddBtn);

    document.getElementById('pm-add-btn').onclick = () => {
        if (!currentProduct) return;
        const p = currentProduct;

        // 驗證必填
        const required = (p.product_options || []).filter(o => o.required);
        for (const opt of required) {
            const fields = [...document.querySelectorAll(`.opt-field[data-opt-id="${opt.id}"]`)];
            const hasValue = fields.some(f => {
                if (f.type === 'radio' || f.type === 'checkbox') return f.checked;
                if (f.type === 'hidden') return parseInt(f.value) > 0;
                return f.value.trim().length > 0;
            });
            if (!hasValue) { alert(`請選擇「${opt.label}」`); return; }
        }

        // 收集選項
        const selectedOptions = {};
        const optMap = {};
        (p.product_options || []).forEach(o => optMap[o.id] = o);
        document.querySelectorAll('.opt-field').forEach(el => {
            const id = el.dataset.optId;
            const type = el.dataset.optType;
            if (type === 'text') { selectedOptions[id] = { label: el.dataset.optLabel, value: el.value, type }; }
            else if ((el.type === 'radio' || el.type === 'checkbox') && el.checked) {
                if (!selectedOptions[id]) selectedOptions[id] = { label: el.dataset.optLabel, type, choices: [] };
                selectedOptions[id].choices.push({ label: el.dataset.choiceLabel, price: parseInt(el.dataset.choicePrice || 0) });
            }
        });

        const extraPrice = calcOptionsExtra();
        const lineTotal = (p.price + extraPrice) * pmQty;

        // 加入購物車（相同商品+相同選項 → 合併）
        const key = JSON.stringify({ id: p.id, opts: selectedOptions });
        const existing = cart.find(c => JSON.stringify({ id: c.product.id, opts: c.options }) === key);
        if (existing) {
            existing.qty += pmQty;
            existing.lineTotal = (p.price + extraPrice) * existing.qty;
        } else {
            cart.push({ product: p, qty: pmQty, options: selectedOptions, extraPrice, lineTotal });
        }

        updateCartUI();
        closeProductModal();
    };

    // ── 3. 購物車 UI ──
    function updateCartUI() {
        const totalQty = cart.reduce((s, c) => s + c.qty, 0);
        const totalPrice = cart.reduce((s, c) => s + c.lineTotal, 0);

        // 卡片角落 pill
        allProducts.forEach(p => {
            const pill = document.getElementById(`cart-pill-${p.id}`);
            if (!pill) return;
            const qty = cart.filter(c => c.product.id === p.id).reduce((s, c) => s + c.qty, 0);
            if (qty > 0) { pill.textContent = qty; pill.classList.remove('hidden'); }
            else { pill.classList.add('hidden'); }
        });

        // Mobile bar
        const bar = document.getElementById('cart-bar');
        if (totalQty > 0) {
            bar.classList.remove('translate-y-full');
            document.getElementById('cart-count-bar').textContent = `${totalQty} 項`;
            document.getElementById('cart-total-bar').textContent = `NT$ ${totalPrice}`;
        } else {
            bar.classList.add('translate-y-full');
        }

        // Mobile header button
        const mob = document.getElementById('cart-count-mobile');
        if (totalQty > 0) { mob.textContent = totalQty; mob.classList.remove('hidden'); }
        else { mob.classList.add('hidden'); }

        // Desktop sidebar
        document.getElementById('cart-count-desktop').textContent = `${totalQty} 項`;
        document.getElementById('cart-total-desktop').textContent = `NT$ ${totalPrice}`;
        const btnDeskTop = document.getElementById('btn-checkout-desktop');
        if (btnDeskTop) btnDeskTop.disabled = totalQty === 0;

        const listDesktop = document.getElementById('cart-list-desktop');
        if (totalQty === 0) {
            listDesktop.innerHTML = '<p class="text-center text-gray-300 text-sm py-10 px-4">尚未選擇任何餐點</p>';
        } else {
            listDesktop.innerHTML = cart.map((c, ci) => `
            <div class="px-4 py-3 flex items-start gap-3">
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-gray-800 text-sm">${c.product.name}</p>
                    ${Object.values(c.options).map(o =>
                `<p class="text-xs text-gray-400">${o.label}: ${o.choices ? o.choices.map(ch => ch.label).join('、') : (o.value || '')}</p>`
            ).join('')}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <div class="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-100 p-0.5">
                        <button class="w-6 h-6 flex items-center justify-center rounded text-gray-500 active:scale-90" onclick="cartAdjust(${ci},-1)"><i data-lucide="minus" class="w-3 h-3"></i></button>
                        <span class="w-5 text-center text-xs font-bold">${c.qty}</span>
                        <button class="w-6 h-6 flex items-center justify-center rounded bg-emerald-500 text-white active:scale-90" onclick="cartAdjust(${ci},1)"><i data-lucide="plus" class="w-3 h-3"></i></button>
                    </div>
                    <span class="text-xs font-black text-gray-700 w-14 text-right">NT$${c.lineTotal}</span>
                </div>
            </div>`).join('');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    window.cartAdjust = function (idx, delta) {
        if (!cart[idx]) return;
        cart[idx].qty += delta;
        if (cart[idx].qty <= 0) cart.splice(idx, 1);
        else cart[idx].lineTotal = (cart[idx].product.price + cart[idx].extraPrice) * cart[idx].qty;
        updateCartUI();
    };

    // ── 4. 結帳 ──
    function openCheckout() {
        if (cart.length === 0) return;
        const total = cart.reduce((s, c) => s + c.lineTotal, 0);
        document.getElementById('checkout-total').textContent = total;
        document.getElementById('checkout-items').innerHTML = cart.map(c => `
            <div class="flex items-center justify-between text-sm">
                <span class="font-bold text-gray-800">${c.product.name} ×${c.qty}</span>
                <span class="font-black text-gray-700">NT$ ${c.lineTotal}</span>
            </div>
            ${Object.values(c.options).map(o => `<p class="text-xs text-gray-400 ml-4">${o.label}: ${o.choices ? o.choices.map(ch => ch.label).join('、') : (o.value || '')}</p>`).join('')}
        `).join('');
        const payment = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
        document.getElementById('checkout-cash-note').classList.toggle('hidden', payment !== 'cash');

        // 同步桌面版備註到 checkout modal
        const desktopNote = document.getElementById('cart-note-desktop')?.value?.trim() || '';
        const checkoutNoteEl = document.getElementById('checkout-note');
        if (checkoutNoteEl && desktopNote && !checkoutNoteEl.value) checkoutNoteEl.value = desktopNote;

        showModal('checkout-modal');
    }

    document.getElementById('btn-checkout')?.addEventListener('click', openCheckout);
    document.getElementById('btn-checkout-desktop')?.addEventListener('click', openCheckout);
    document.getElementById('btn-cart-mobile')?.addEventListener('click', openCheckout);
    document.getElementById('btn-close-checkout')?.addEventListener('click', () => hideModal('checkout-modal'));
    document.querySelector('input[name="payment"]')?.closest('.grid')?.addEventListener('change', () => {
        const val = document.querySelector('input[name="payment"]:checked')?.value;
        document.getElementById('checkout-cash-note').classList.toggle('hidden', val !== 'cash');
    });

    document.getElementById('btn-confirm-order')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-confirm-order');
        btn.disabled = true;
        btn.textContent = '送出中...';

        const payment = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
        const note = document.getElementById('checkout-note')?.value.trim() || '';
        const total = cart.reduce((s, c) => s + c.lineTotal, 0);

        // 流水號
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const { count } = await window.supabaseClient.from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', storeId).gte('created_at', todayStart.toISOString());
        const dailyNumber = (count || 0) + 1;

        const { data: order, error } = await window.supabaseClient.from('orders').insert({
            store_id: storeId,
            table_name: tableName,
            status: 'pending',
            total_price: total,
            payment_method: payment,
            is_paid: false,
            note,
            daily_number: dailyNumber
        }).select().single();

        if (error || !order) {
            alert('送出失敗，請重試');
            btn.disabled = false; btn.textContent = '送出訂單';
            return;
        }

        await window.supabaseClient.from('order_items').insert(
            cart.map(c => ({
                order_id: order.id,
                product_id: c.product.id,
                product_name: c.product.name,
                product_price: c.product.price,
                quantity: c.qty,
                subtotal: c.lineTotal,
                options: Object.keys(c.options).length > 0 ? c.options : null
            }))
        );

        cart = [];
        updateCartUI();
        hideModal('checkout-modal');
        showOrderTracking(order.id, dailyNumber);
    });

    // ── 5. 訂單追蹤 ──
    function showOrderTracking(orderId, dailyNumber) {
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

        const html = `
        <div id="tracking-screen" class="fixed inset-0 z-[100] bg-[#f8fafc] overflow-y-auto">
            <div class="max-w-md mx-auto px-5 py-10 flex flex-col gap-6">
                <div class="text-center">
                    <p class="text-sm font-bold text-gray-400 mb-1">訂單號碼</p>
                    <div class="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-3">
                        <span class="font-mono font-black text-amber-800 tracking-widest text-2xl">#${String(dailyNumber).padStart(3, '0')}</span>
                    </div>
                    <p class="text-xs text-gray-400 mt-2">${tableName}</p>
                </div>

                <div id="status-card" class="bg-white rounded-3xl shadow-md border border-gray-100 p-6 text-center transition-all duration-500">
                    <div id="status-icon-wrap" class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-500 bg-amber-50 border-2 border-amber-200">
                        <i id="status-icon" data-lucide="banknote" class="w-10 h-10 text-amber-500"></i>
                    </div>
                    <h2 id="status-label" class="text-2xl font-black text-gray-800 mb-1">待付款</h2>
                    <p id="status-desc" class="text-sm text-gray-500">請到櫃檯付款，完成後廚房即開始製作</p>
                </div>

                <!-- 進度條 -->
                <div class="relative flex justify-between px-4">
                    <div class="absolute left-4 right-4 top-4 h-1 bg-gray-200 rounded-full -z-0">
                        <div id="progress-fill" class="h-full bg-emerald-400 rounded-full transition-all duration-700" style="width:0%"></div>
                    </div>
                    ${steps.map((s, i) => `
                    <div class="flex flex-col items-center gap-2 z-10" id="step-dot-wrap-${i}">
                        <div id="step-dot-${i}" class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-500 bg-white border-gray-200 text-gray-400">${i + 1}</div>
                        <span class="text-[10px] font-bold text-gray-400 whitespace-nowrap" id="step-label-${i}">${stepLabels[i]}</span>
                    </div>`).join('')}
                </div>

                <button id="btn-back-to-menu" class="mx-auto flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm font-bold transition-colors">
                    <i data-lucide="arrow-left" class="w-4 h-4"></i> 繼續點餐
                </button>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        updateStatusUI('pending');

        realtimeChannel = window.supabaseClient
            .channel(`order-tracking-${orderId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
                payload => updateStatusUI(payload.new.status))
            .subscribe();

        document.getElementById('btn-back-to-menu').onclick = () => {
            if (realtimeChannel) { window.supabaseClient.removeChannel(realtimeChannel); realtimeChannel = null; }
            document.getElementById('tracking-screen').remove();
        };

        function updateStatusUI(status) {
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
            const currentStep = steps.indexOf(status);
            document.getElementById('status-icon-wrap').className = `w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-500 ${cfg.bg} border-2 ${cfg.border}`;
            document.getElementById('status-icon').setAttribute('data-lucide', cfg.icon);
            document.getElementById('status-icon').className = `w-10 h-10 ${cfg.color}`;
            document.getElementById('status-label').textContent = cfg.label;
            const descs = {
                pending: '請到櫃檯付款，完成後廚房即開始製作', confirmed: '付款已確認！廚房馬上開始為您準備 ✅',
                preparing: '廚師正在精心製作您的餐點 🍳', ready: '餐點已準備好，服務員即將為您上菜！',
                completed: '感謝您的光臨，用餐愉快！', cancelled: '很抱歉，此訂單已被取消',
            };
            document.getElementById('status-desc').textContent = descs[status] || '';
            const pct = currentStep > 0 ? (currentStep / (steps.length - 1)) * 100 : 0;
            document.getElementById('progress-fill').style.width = pct + '%';
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
    }

    // ── 6. Realtime（店家營業狀態）──
    function subscribeRealtime() {
        window.supabaseClient
            .channel('order-store-status')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${storeId}` },
                payload => {
                    if (payload.new.is_open === false) document.getElementById('closed-overlay').classList.remove('hidden');
                    else document.getElementById('closed-overlay').classList.add('hidden');
                })
            .subscribe();
    }

    // ── 7. Modal 工具 ──
    function showModal(id) {
        const m = document.getElementById(id);
        m.classList.remove('hidden');
        requestAnimationFrame(() => {
            m.classList.remove('opacity-0');
            m.querySelector('.modal-card')?.classList.remove('scale-95', 'opacity-0');
        });
    }
    function hideModal(id) {
        const m = document.getElementById(id);
        m.classList.add('opacity-0');
        m.querySelector('.modal-card')?.classList.add('scale-95', 'opacity-0');
        setTimeout(() => m.classList.add('hidden'), 300);
    }

    // ── 8. bind UI ──
    function bindUI() { lucide.createIcons(); }

})();