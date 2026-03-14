// =============================================
// order.js — 顧客點餐頁（全置中彈窗完美版）
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
    let cart = [];
    let currentProduct = null;
    let pmQty = 1;
    let realtimeChannel = null;
    let editingCartIndex = -1;

    // ── 初始化 ──
    document.getElementById('table-badge').textContent = tableName;

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
            const { data: categories } = await window.supabaseClient
                .from('categories').select('id, name, sort_order')
                .eq('store_id', storeId).order('sort_order', { ascending: true });
            const catMap = {};
            (categories || []).forEach(c => { catMap[c.id] = c; });

            const { data: products, error } = await window.supabaseClient
                .from('products').select('id, category_id, name, price, description, image_url, is_available')
                .eq('store_id', storeId).eq('is_available', true).order('name');
            if (error) throw error;

            const { data: allOptions } = await window.supabaseClient
                .from('product_options').select('*')
                .eq('store_id', storeId).order('sort_order', { ascending: true });
            const optionsMap = {};
            (allOptions || []).forEach(opt => {
                if (!optionsMap[opt.product_id]) optionsMap[opt.product_id] = [];
                optionsMap[opt.product_id].push(opt);
            });

            allProducts = (products || []).map(p => ({
                ...p,
                categories: catMap[p.category_id] || { name: '其他', sort_order: 99 },
                product_options: optionsMap[p.id] || []
            }));

            const grouped = {};
            allProducts.forEach(p => {
                const catName = p.categories?.name || '其他';
                if (!grouped[catName]) grouped[catName] = { sort: p.categories?.sort_order ?? 99, items: [] };
                grouped[catName].items.push(p);
            });
            const sortedGroups = Object.entries(grouped).sort((a, b) => a[1].sort - b[1].sort);

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

            let html = '';
            sortedGroups.forEach(([cat, group], i) => {
                const items = group.items;
                html += `<div id="cat-${i}" class="mb-4 pt-4 scroll-mt-[140px]">
                    <h2 class="text-[1.15rem] font-black text-gray-800 mb-2 px-4">${cat}</h2>
                    <div class="bg-white flex flex-col border-y border-gray-100">`;

                items.forEach(p => {
                    const hasImg = !!p.image_url;
                    html += `
                    <div class="flex items-start justify-between p-4 bg-white active:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-b-0" data-id="${p.id}" onclick="openProductModal('${p.id}')">
                        <div class="flex-1 min-w-0 ${hasImg ? 'pr-4' : 'pr-6'}">
                            <h3 class="font-bold text-gray-800 text-base mb-1 leading-tight">${p.name}</h3>
                            ${p.description ? `<p class="text-sm text-gray-500 line-clamp-2 mb-2 leading-relaxed">${p.description}</p>` : ''}
                            <div class="font-medium text-gray-800 mt-1">NT$ ${p.price}</div>
                        </div>

                        <div class="flex flex-col items-end shrink-0 gap-3">
                            ${hasImg ? `
                            <div class="relative w-[100px] h-[100px] rounded-xl overflow-hidden shadow-sm bg-gray-50 border border-gray-100">
                                <img src="${p.image_url}" class="w-full h-full object-cover" loading="lazy" />
                            </div>
                            ` : ''}
                            <div id="inline-act-${p.id}" onclick="event.stopPropagation()"></div>
                        </div>
                    </div>`;
                });
                html += `</div></div>`;
            });

            document.getElementById('menu-container').innerHTML = html || '<p class="text-center text-gray-400 py-20">目前沒有供應中的餐點</p>';
            updateMenuCardQty();
        } catch (e) {
            console.error('loadMenu error:', e);
            document.getElementById('menu-container').innerHTML = '<p class="text-center text-red-500 py-20 font-bold">載入失敗，請重新整理</p>';
        }
    }

    function updateMenuCardQty() {
        allProducts.forEach(p => {
            const qtyWrap = document.getElementById(`inline-act-${p.id}`);
            if (!qtyWrap) return;

            const qtyInCart = cart.filter(c => c.product.id === p.id).reduce((s, c) => s + c.qty, 0);

            if (qtyInCart > 0) {
                const minusIcon = qtyInCart === 1 ? 'trash-2' : 'minus';
                const minusColor = qtyInCart === 1 ? 'text-red-500' : '';

                qtyWrap.innerHTML = `
                    <button class="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-gray-200 transition-colors" onclick="quickAdjust(event, '${p.id}', -1)"><i data-lucide="${minusIcon}" class="w-4 h-4 ${minusColor}"></i></button>
                    <span class="w-6 text-center text-sm font-bold text-gray-800">${qtyInCart}</span>
                    <button class="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-gray-200 transition-colors" onclick="quickAdjust(event, '${p.id}', 1)"><i data-lucide="plus" class="w-4 h-4"></i></button>
                `;
                qtyWrap.className = "inline-flex items-center bg-gray-100 rounded-full shadow-sm border border-gray-200 overflow-hidden";
            } else {
                qtyWrap.innerHTML = `
                    <button class="w-8 h-8 flex items-center justify-center text-gray-600 transition-colors" onclick="quickAdjust(event, '${p.id}', 1)"><i data-lucide="plus" class="w-5 h-5"></i></button>
                `;
                qtyWrap.className = "inline-flex items-center justify-center bg-gray-100 rounded-full shadow-sm border border-gray-200 active:scale-95 transition-transform hover:bg-gray-200";
            }
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    window.quickAdjust = function (e, productId, delta) {
        e.stopPropagation();
        const p = allProducts.find(x => x.id === productId);
        if (!p) return;

        const hasOptions = p.product_options && p.product_options.length > 0;

        if (delta > 0) {
            if (hasOptions) {
                openProductModal(productId);
            } else {
                const existing = cart.find(c => c.product.id === productId);
                if (existing) {
                    existing.qty++;
                    existing.lineTotal = existing.product.price * existing.qty;
                } else {
                    cart.push({ product: p, qty: 1, options: {}, extraPrice: 0, lineTotal: p.price });
                }
                updateCartUI();
            }
        } else {
            const cartItems = cart.filter(c => c.product.id === productId);
            if (cartItems.length === 0) return;

            const lastItem = cartItems[cartItems.length - 1];
            lastItem.qty--;
            if (lastItem.qty <= 0) {
                const idx = cart.lastIndexOf(lastItem);
                cart.splice(idx, 1);
            } else {
                lastItem.lineTotal = (lastItem.product.price + lastItem.extraPrice) * lastItem.qty;
            }
            updateCartUI();
        }
    };


    // ── 2. 餐點 Modal (🌟 置中動畫版) ──
    window.openProductModal = function (productId, cartIdx = -1) {
        const p = allProducts.find(x => x.id === productId);
        if (!p) return;
        currentProduct = p;
        editingCartIndex = cartIdx;

        let existingOpts = {};
        if (cartIdx !== -1) {
            existingOpts = cart[cartIdx].options || {};
            pmQty = cart[cartIdx].qty;
        } else {
            pmQty = 1;
        }

        document.getElementById('pm-name').textContent = p.name;
        document.getElementById('pm-price').textContent = `NT$ ${p.price}`;
        document.getElementById('pm-desc').textContent = p.description || '';
        document.getElementById('pm-qty').textContent = pmQty;

        const imgWrap = document.getElementById('pm-img-wrap');
        const img = document.getElementById('pm-img');
        const closeNoImg = document.getElementById('pm-close-no-img');

        // 有圖無圖的關閉按鈕切換
        if (p.image_url) {
            img.src = p.image_url;
            imgWrap.classList.remove('hidden');
            if (closeNoImg) closeNoImg.classList.add('hidden');
        } else {
            imgWrap.classList.add('hidden');
            if (closeNoImg) closeNoImg.classList.remove('hidden');
        }

        const optContainer = document.getElementById('pm-options');
        const options = p.product_options || [];
        if (options.length === 0) {
            optContainer.innerHTML = '';
        } else {
            optContainer.innerHTML = options.sort((a, b) => a.sort_order - b.sort_order).map(opt => {
                const choices = opt.choices || [];
                const exist = existingOpts[opt.id];

                if (opt.type === 'text') {
                    const textVal = exist ? exist.value : '';
                    return `<div>
                        <label class="block text-sm font-bold text-gray-700 mb-2">${opt.label}${opt.required ? ' <span class="text-red-400">*</span>' : ''}</label>
                        <textarea class="opt-field w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none" rows="2" data-opt-id="${opt.id}" data-opt-label="${opt.label}" data-opt-type="text" placeholder="請輸入...">${textVal}</textarea>
                    </div>`;
                }
                const isMulti = opt.type === 'multi';
                return `<div>
                    <label class="block text-sm font-bold text-gray-700 mb-2">${opt.label}${opt.required ? ' <span class="text-red-400">*</span>' : ''} <span class="text-xs font-normal text-gray-400">${isMulti ? '（可多選）' : '（單選）'}</span></label>
                    <div class="flex flex-wrap gap-2">
                        ${choices.map((c, ci) => {
                    let checked = false;
                    if (exist && exist.choices) {
                        checked = exist.choices.some(ch => ch.label === c.label);
                    } else if (!isMulti && ci === 0 && cartIdx === -1) {
                        checked = true;
                    }
                    return `
                            <label class="flex items-center gap-1.5 px-3 py-2 border-2 rounded-xl cursor-pointer has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 border-gray-200 transition-all">
                                <input type="${isMulti ? 'checkbox' : 'radio'}" name="opt-${opt.id}" value="${ci}" class="opt-field sr-only" data-opt-id="${opt.id}" data-opt-label="${opt.label}" data-opt-type="${opt.type}" data-choice-label="${c.label}" data-choice-price="${c.price || 0}" ${checked ? 'checked' : ''}>
                                <span class="text-sm font-bold text-gray-700">${c.label}</span>
                                ${c.price ? `<span class="text-xs text-emerald-600 font-bold">+${c.price}</span>` : ''}
                            </label>`;
                }).join('')}
                    </div>
                </div>`;
            }).join('');
        }

        updateModalAddBtn();

        // 🌟 置中彈窗的淡入縮放動畫
        const wrapper = document.getElementById('product-modal-wrapper');
        const backdrop = document.getElementById('product-modal-backdrop');
        const modal = document.getElementById('product-modal');

        if (wrapper) wrapper.classList.remove('hidden');
        requestAnimationFrame(() => {
            if (backdrop) backdrop.classList.remove('opacity-0');
            if (modal) modal.classList.remove('scale-95', 'opacity-0');
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    window.closeProductModal = function () {
        const wrapper = document.getElementById('product-modal-wrapper');
        const backdrop = document.getElementById('product-modal-backdrop');
        const modal = document.getElementById('product-modal');

        // 🌟 置中彈窗的淡出縮小動畫
        if (backdrop) backdrop.classList.add('opacity-0');
        if (modal) modal.classList.add('scale-95', 'opacity-0');

        setTimeout(() => {
            if (wrapper) wrapper.classList.add('hidden');
        }, 300);

        currentProduct = null;
        editingCartIndex = -1;
    };

    function updateModalAddBtn() {
        if (!currentProduct) return;
        const extraPrice = calcOptionsExtra();
        const total = (currentProduct.price + extraPrice) * pmQty;
        const btnText = editingCartIndex !== -1 ? '更新修改' : '加入點單';
        document.getElementById('pm-add-btn').textContent = `${btnText} · NT$ ${total}`;
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

    document.getElementById('pm-options').addEventListener('change', updateModalAddBtn);

    document.getElementById('pm-add-btn').onclick = () => {
        if (!currentProduct) return;
        const p = currentProduct;

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

        const selectedOptions = {};
        document.querySelectorAll('.opt-field').forEach(el => {
            const id = el.dataset.optId;
            const type = el.dataset.optType;
            if (type === 'text') {
                if (el.value.trim()) selectedOptions[id] = { label: el.dataset.optLabel, value: el.value.trim(), type };
            }
            else if ((el.type === 'radio' || el.type === 'checkbox') && el.checked) {
                if (!selectedOptions[id]) selectedOptions[id] = { label: el.dataset.optLabel, type, choices: [] };
                selectedOptions[id].choices.push({ label: el.dataset.choiceLabel, price: parseInt(el.dataset.choicePrice || 0) });
            }
        });

        const extraPrice = calcOptionsExtra();
        const lineTotal = (p.price + extraPrice) * pmQty;

        if (editingCartIndex !== -1) {
            cart[editingCartIndex].qty = pmQty;
            cart[editingCartIndex].options = selectedOptions;
            cart[editingCartIndex].extraPrice = extraPrice;
            cart[editingCartIndex].lineTotal = lineTotal;
        } else {
            const key = JSON.stringify({ id: p.id, opts: selectedOptions });
            const existing = cart.find(c => JSON.stringify({ id: c.product.id, opts: c.options }) === key);
            if (existing) {
                existing.qty += pmQty;
                existing.lineTotal = (p.price + existing.extraPrice) * existing.qty;
            } else {
                cart.push({ product: p, qty: pmQty, options: selectedOptions, extraPrice, lineTotal });
            }
        }

        updateCartUI();

        const checkoutModal = document.getElementById('checkout-modal');
        if (checkoutModal && !checkoutModal.classList.contains('hidden')) {
            openCheckout();
        }

        closeProductModal();
    };

    // ── 3. 購物車 UI ──
    function updateCartUI() {
        const totalQty = cart.reduce((s, c) => s + c.qty, 0);
        const totalPrice = cart.reduce((s, c) => s + c.lineTotal, 0);

        const bar = document.getElementById('cart-bar');
        if (totalQty > 0) {
            bar.classList.remove('translate-y-full');
            document.getElementById('cart-count-bar').textContent = `${totalQty} 項`;
            document.getElementById('cart-total-bar').textContent = `NT$ ${totalPrice}`;
        } else {
            bar.classList.add('translate-y-full');
        }

        const mob = document.getElementById('cart-count-mobile');
        if (totalQty > 0) { mob.textContent = totalQty; mob.classList.remove('hidden'); }
        else { mob.classList.add('hidden'); }

        document.getElementById('cart-count-desktop').textContent = `${totalQty} 項`;
        document.getElementById('cart-total-desktop').textContent = `NT$ ${totalPrice}`;
        const btnDeskTop = document.getElementById('btn-checkout-desktop');
        if (btnDeskTop) btnDeskTop.disabled = totalQty === 0;

        const listDesktop = document.getElementById('cart-list-desktop');
        if (totalQty === 0) {
            listDesktop.innerHTML = '<p class="text-center text-gray-300 text-sm py-10 px-4">尚未選擇任何餐點</p>';
        } else {
            listDesktop.innerHTML = cart.map((c, ci) => `
            <div class="px-4 py-3 flex items-start gap-3 group">
                <div class="flex-1 min-w-0 cursor-pointer pr-2" onclick="editCartItem(${ci})" title="點擊修改選項">
                    <div class="flex items-center gap-1.5 mb-0.5">
                        <p class="font-bold text-gray-800 text-sm group-hover:text-emerald-600 transition-colors break-words">${c.product.name}</p>
                        <i data-lucide="edit-3" class="w-3 h-3 shrink-0 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                    ${Object.values(c.options).map(o =>
                `<p class="text-[11px] text-gray-400 leading-tight break-words whitespace-pre-wrap">${o.label}: ${o.choices ? o.choices.map(ch => ch.label).join('、') : (o.value || '')}</p>`
            ).join('')}
                </div>
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                    <span class="text-sm font-black text-gray-700">NT$${c.lineTotal}</span>
                    <div class="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-100 p-0.5">
                        <button class="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 active:scale-90 transition-all" onclick="cartAdjust(${ci},-1)">
                            <i data-lucide="${c.qty === 1 ? 'trash-2' : 'minus'}" class="w-3.5 h-3.5 ${c.qty === 1 ? 'text-red-500' : ''}"></i>
                        </button>
                        <span class="w-5 text-center text-xs font-bold">${c.qty}</span>
                        <button class="w-6 h-6 flex items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600 active:scale-90 transition-all" onclick="cartAdjust(${ci},1)">
                            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            </div>`).join('');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        updateMenuCardQty();
    }

    window.editCartItem = function (idx) {
        const item = cart[idx];
        if (!item) return;
        openProductModal(item.product.id, idx);
    };

    window.cartAdjust = function (idx, delta) {
        if (!cart[idx]) return;
        cart[idx].qty += delta;
        if (cart[idx].qty <= 0) {
            cart.splice(idx, 1);
        } else {
            cart[idx].lineTotal = (cart[idx].product.price + cart[idx].extraPrice) * cart[idx].qty;
        }

        updateCartUI();

        const checkoutModal = document.getElementById('checkout-modal');
        if (checkoutModal && !checkoutModal.classList.contains('hidden')) {
            if (cart.length === 0) hideModal('checkout-modal');
            else openCheckout();
        }
    };

    // ── 4. 結帳 ──
    function openCheckout() {
        if (cart.length === 0) return;
        const total = cart.reduce((s, c) => s + c.lineTotal, 0);
        document.getElementById('checkout-total').textContent = total;

        document.getElementById('checkout-items').innerHTML = cart.map((c, ci) => `
            <div class="flex items-start justify-between gap-3 py-4 border-b border-gray-50 last:border-0 group">
                <div class="flex-1 min-w-0 cursor-pointer pr-2" onclick="editCartItem(${ci})" title="點擊修改客製化選項">
                    <div class="flex items-center gap-1.5 mb-1">
                        <span class="font-bold text-gray-800 text-sm group-hover:text-emerald-600 transition-colors break-words">${c.product.name}</span>
                        <i data-lucide="edit-3" class="w-3.5 h-3.5 shrink-0 text-emerald-500 opacity-30 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                    ${Object.values(c.options).map(o => `<p class="text-xs text-gray-400 mt-0.5 leading-relaxed break-words whitespace-pre-wrap">${o.label}: ${o.choices ? o.choices.map(ch => ch.label).join('、') : (o.value || '')}</p>`).join('')}
                    ${Object.keys(c.options).length === 0 && c.product.product_options?.length > 0 ? `<p class="text-[11px] text-emerald-500 mt-0.5 font-bold">點擊新增客製化</p>` : ''}
                </div>
                <div class="flex flex-col items-end gap-2 shrink-0">
                    <span class="font-black text-gray-700 text-sm">NT$ ${c.lineTotal}</span>
                    <div class="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-200 p-0.5 shadow-sm">
                        <button class="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 active:scale-90 transition-all" onclick="cartAdjust(${ci},-1)">
                            <i data-lucide="${c.qty === 1 ? 'trash-2' : 'minus'}" class="w-4 h-4 ${c.qty === 1 ? 'text-red-500' : ''}"></i>
                        </button>
                        <span class="w-6 text-center text-sm font-bold text-gray-800">${c.qty}</span>
                        <button class="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-500 text-white hover:bg-emerald-600 active:scale-90 transition-all" onclick="cartAdjust(${ci},1)">
                            <i data-lucide="plus" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();

        const payment = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
        document.getElementById('checkout-cash-note').classList.toggle('hidden', payment !== 'cash');

        const desktopNote = document.getElementById('cart-note-desktop')?.value?.trim() || '';
        const checkoutNoteEl = document.getElementById('checkout-note');
        if (checkoutNoteEl && desktopNote && !checkoutNoteEl.value) checkoutNoteEl.value = desktopNote;

        showModal('checkout-modal');
    }

    document.getElementById('btn-checkout')?.addEventListener('click', openCheckout);
    document.getElementById('btn-checkout-desktop')?.addEventListener('click', openCheckout);
    document.getElementById('btn-cart-mobile')?.addEventListener('click', openCheckout);

    // 🌟 點擊叉叉關閉
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
        // ... (保持原樣)
    }

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

    // ── 7. Modal 工具 (🌟 改為純縮放，移除 translate-y-full) ──
    window.showModal = function (id) {
        const m = document.getElementById(id);
        if (!m) return;
        m.classList.remove('hidden');
        requestAnimationFrame(() => {
            m.classList.remove('opacity-0');
            const card = m.querySelector('.modal-card');
            // 只要拿掉 scale-95 和 opacity-0 就會從中間彈出來了！
            if (card) card.classList.remove('scale-95', 'opacity-0');
        });
    }

    window.hideModal = function (id) {
        const m = document.getElementById(id);
        if (!m) return;
        m.classList.add('opacity-0');
        const card = m.querySelector('.modal-card');
        if (card) card.classList.add('scale-95', 'opacity-0');
        setTimeout(() => m.classList.add('hidden'), 300);
    }

    function bindUI() { lucide.createIcons(); }

})();