// =============================================
// order.js — 顧客點餐頁 (整頁進度追蹤 + 阻擋返回 + 行動支付)
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


    // ── 2. 餐點 Modal ──
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
        if (typeof lucide !== 'undefined') lucide.createIcons();
        showModal('product-modal');
    };

    window.closeProductModal = function () {
        hideModal('product-modal');
        setTimeout(() => {
            currentProduct = null;
            editingCartIndex = -1;
        }, 300);
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

        // 🌟 更新這裡的手機版結帳顯示：將 LINE Pay 修改為行動支付
        const paymentHTML = `
            <label class="block text-sm font-bold text-gray-700 mb-2">付款方式</label>
            <div class="grid grid-cols-3 gap-2 mb-4">
                <label class="relative flex flex-col items-center justify-center py-2.5 border-2 border-emerald-500 bg-emerald-50 rounded-xl cursor-pointer transition-all">
                    <input type="radio" name="payment" value="cash" class="sr-only" checked>
                    <i data-lucide="banknote" class="w-5 h-5 text-emerald-600 mb-1"></i>
                    <span class="text-xs font-bold text-emerald-700">現金</span>
                </label>
                <label class="relative flex flex-col items-center justify-center py-2.5 border-2 border-gray-100 bg-gray-50 rounded-xl opacity-50 cursor-not-allowed">
                    <input type="radio" name="payment" value="card" class="sr-only" disabled>
                    <i data-lucide="credit-card" class="w-5 h-5 text-gray-400 mb-1"></i>
                    <span class="text-[10px] font-bold text-gray-500">刷卡</span>
                </label>
                <label class="relative flex flex-col items-center justify-center py-2.5 border-2 border-gray-100 bg-gray-50 rounded-xl opacity-50 cursor-not-allowed">
                    <input type="radio" name="payment" value="linepay" class="sr-only" disabled>
                    <i data-lucide="smartphone" class="w-5 h-5 text-gray-400 mb-1"></i>
                    <span class="text-[10px] font-bold text-gray-500">行動支付</span>
                </label>
            </div>
        `;

        // 如果 HTML 裡有預先寫好的付款區塊，直接將行動支付文字更新
        document.querySelectorAll('input[name="payment"][value="linepay"] ~ span').forEach(el => {
            el.textContent = '行動支付';
        });

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

        // 🌟 1. 直接寫入訂單！
        // 我們不傳 daily_number，讓 Supabase 後端的 Trigger 自動幫我們發號碼！
        const { data: order, error } = await window.supabaseClient.from('orders').insert({
            store_id: storeId,
            table_name: tableName,
            status: 'pending',
            total_price: total,
            payment_method: payment,
            is_paid: false,
            note
        }).select().single();

        if (error || !order) {
            alert('送出失敗，請重試');
            btn.disabled = false; btn.textContent = '送出訂單';
            return;
        }

        // 🌟 2. 拿回「資料庫保證不重複」的終極號碼
        const finalDailyNumber = order.daily_number;

        // 3. 寫入訂單明細
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

        // 4. 清空購物車並顯示追蹤畫面 (傳入資料庫給的正確號碼)
        cart = [];
        updateCartUI();
        hideModal('checkout-modal');
        showOrderTracking(order.id, finalDailyNumber);
    });

    // ── 5. 訂單追蹤 (🌟 整頁顯示 + 阻擋上一頁 + 高質感警告窗) ──
    window.showOrderTracking = function (orderId, dailyNumber) {
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

        // 🌟 隱藏原本菜單的背景
        const mainHeader = document.querySelector('header');
        const mainContent = document.querySelector('.max-w-6xl');
        const mobileCart = document.getElementById('cart-bar');
        if (mainHeader) mainHeader.classList.add('hidden');
        if (mainContent) mainContent.classList.add('hidden');
        if (mobileCart) mobileCart.classList.add('hidden');

        // 🌟 注入全螢幕追蹤頁面 + 高質感警告彈窗 HTML
        const html = `
        <div id="tracking-page" class="fixed inset-0 z-[9999] bg-[#f8fafc] flex flex-col overflow-y-auto">
            <div class="w-full max-w-md mx-auto bg-white min-h-screen shadow-sm flex flex-col relative pb-10 border-x border-gray-50">
                <div class="px-5 py-4 border-b border-gray-100 flex justify-center items-center bg-white sticky top-0 z-10 shadow-sm">
                    <h3 class="font-black text-gray-800 text-lg tracking-wide">訂單進度</h3>
                </div>
                <div class="flex-1 p-6 flex flex-col gap-6 mt-4">
                    <div class="text-center">
                        <p class="text-sm font-bold text-gray-400 mb-2">您的取餐號碼</p>
                        <div class="inline-flex items-center gap-2 bg-emerald-50 border-2 border-emerald-200 rounded-3xl px-8 py-4 shadow-sm">
                            <span class="font-mono font-black text-emerald-600 tracking-widest text-4xl">#${String(dailyNumber).padStart(3, '0')}</span>
                        </div>
                        <p class="text-sm font-bold text-gray-500 mt-4"><i data-lucide="map-pin" class="w-4 h-4 inline-block mr-1 mb-0.5"></i>${tableName}</p>
                    </div>

                    <div id="status-card" class="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 text-center transition-all duration-500 mt-2">
                        <div id="status-icon-wrap" class="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 transition-all duration-500 bg-amber-50 border-4 border-amber-200 shadow-sm">
                            <i id="status-icon" data-lucide="banknote" class="w-12 h-12 text-amber-500"></i>
                        </div>
                        <h2 id="status-label" class="text-2xl font-black text-gray-800 mb-2">待付款</h2>
                        <p id="status-desc" class="text-sm font-bold text-gray-500 leading-relaxed">請到櫃檯付款，完成後廚房即開始製作</p>
                    </div>

                    <div class="relative flex justify-between px-2 mt-4 mb-4">
                        <div class="absolute left-4 right-4 top-4 h-1.5 bg-gray-100 rounded-full -z-0">
                            <div id="progress-fill" class="h-full bg-emerald-400 rounded-full transition-all duration-700 shadow-sm" style="width:0%"></div>
                        </div>
                        ${steps.map((s, i) => `
                        <div class="flex flex-col items-center gap-2.5 z-10" id="step-dot-wrap-${i}">
                            <div id="step-dot-${i}" class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-[3px] transition-all duration-500 bg-white border-gray-200 text-gray-400">${i + 1}</div>
                            <span class="text-[11px] font-bold text-gray-400 whitespace-nowrap" id="step-label-${i}">${stepLabels[i]}</span>
                        </div>`).join('')}
                    </div>
                </div>
            </div>
        </div>

        <div id="custom-alert-modal" class="fixed inset-0 z-[10000] flex items-center justify-center p-4 hidden transition-opacity duration-300 opacity-0">
            <div class="absolute inset-0 bg-gray-900/70 backdrop-blur-sm" id="btn-close-alert-bg"></div>
            <div class="relative bg-white w-full max-w-[320px] rounded-[24px] shadow-2xl p-8 text-center transform scale-95 transition-all duration-300 modal-card">
                <div class="w-16 h-16 bg-amber-50 border-4 border-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-5">
                    <i data-lucide="alert-triangle" class="w-8 h-8"></i>
                </div>
                <h3 class="text-xl font-black text-gray-800 mb-2">訂單進行中！</h3>
                <p class="text-sm font-bold text-gray-500 mb-8 leading-relaxed">請保留此畫面，<br>以免錯過取餐叫號喔！</p>
                <button id="btn-close-custom-alert" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 shadow-md shadow-amber-500/20">
                    我知道了
                </button>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        updateStatusUI('pending');

        // 🌟 防呆設計：替換成我們自己寫的高質感彈窗
        window.location.hash = 'tracking';
        window.onpopstate = function () {
            if (window.location.hash !== '#tracking') {
                window.location.hash = 'tracking'; // 把網址拉回來

                // 顯示客製化警告彈窗
                const alertModal = document.getElementById('custom-alert-modal');
                if (alertModal) {
                    alertModal.classList.remove('hidden');
                    setTimeout(() => {
                        alertModal.classList.remove('opacity-0');
                        alertModal.querySelector('.modal-card').classList.remove('scale-95');
                    }, 10);
                }
            }
        };

        window.onbeforeunload = function (e) {
            e.preventDefault();
            e.returnValue = '您的餐點正在準備中，確定要離開嗎？';
            return '您的餐點正在準備中，確定要離開嗎？';
        };

        // 綁定關閉警告窗的邏輯
        function closeCustomAlert() {
            const alertModal = document.getElementById('custom-alert-modal');
            if (alertModal) {
                alertModal.classList.add('opacity-0');
                alertModal.querySelector('.modal-card').classList.add('scale-95');
                setTimeout(() => alertModal.classList.add('hidden'), 300);
            }
        }
        document.getElementById('btn-close-custom-alert').onclick = closeCustomAlert;
        document.getElementById('btn-close-alert-bg').onclick = closeCustomAlert;

        // 即時追蹤邏輯
        realtimeChannel = window.supabaseClient
            .channel(`order-tracking-${orderId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
                payload => updateStatusUI(payload.new.status))
            .subscribe();

        function updateStatusUI(status) {
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
            const currentStep = steps.indexOf(status);

            document.getElementById('status-icon-wrap').className = `w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5 transition-all duration-500 shadow-sm ${cfg.bg} border-4 ${cfg.border}`;
            document.getElementById('status-icon').setAttribute('data-lucide', cfg.icon);
            document.getElementById('status-icon').className = `w-12 h-12 ${cfg.color}`;
            document.getElementById('status-label').textContent = cfg.label;

            const descs = {
                pending: '請到櫃檯出示號碼並付款<br>完成後廚房即開始製作',
                confirmed: '付款已確認！<br>廚房馬上開始為您準備 ✅',
                preparing: '廚師正在精心製作您的餐點 🍳',
                ready: '餐點已準備好，請至櫃檯領取！',
                completed: '感謝您的光臨，祝您用餐愉快！',
                cancelled: '很抱歉，此訂單已被取消。',
            };
            document.getElementById('status-desc').innerHTML = descs[status] || '';

            const pct = currentStep > 0 ? (currentStep / (steps.length - 1)) * 100 : 0;
            document.getElementById('progress-fill').style.width = pct + '%';

            steps.forEach((s, i) => {
                const dot = document.getElementById(`step-dot-${i}`);
                const lbl = document.getElementById(`step-label-${i}`);
                if (!dot) return;

                if (i < currentStep) {
                    dot.className = 'w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-[3px] transition-all duration-500 bg-emerald-500 border-emerald-500 text-white';
                    dot.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
                    lbl.className = 'text-[11px] font-bold text-emerald-500 whitespace-nowrap';
                } else if (i === currentStep) {
                    dot.className = `w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-[3px] transition-all duration-500 ${cfg.bg} ${cfg.border} ${cfg.color}`;
                    dot.textContent = i + 1;
                    lbl.className = `text-[11px] font-black whitespace-nowrap ${cfg.color}`;
                } else {
                    dot.className = 'w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-[3px] transition-all duration-500 bg-white border-gray-200 text-gray-400';
                    dot.textContent = i + 1;
                    lbl.className = 'text-[11px] font-bold text-gray-400 whitespace-nowrap';
                }
            });
            if (typeof lucide !== 'undefined') lucide.createIcons();

            // 🌟 訂單如果完成或取消，就解除「上一頁」的封印
            if (status === 'completed' || status === 'cancelled') {
                window.onpopstate = null;
                window.onbeforeunload = null;
            }
        }
    };

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

    function showModal(id) {
        const m = document.getElementById(id);
        if (!m) return;
        m.classList.remove('hidden');
        setTimeout(() => {
            m.classList.remove('opacity-0');
            m.querySelector('.modal-card')?.classList.remove('scale-95', 'opacity-0');
        }, 10);
    }

    function hideModal(id) {
        const m = document.getElementById(id);
        if (!m) return;
        m.classList.add('opacity-0');
        m.querySelector('.modal-card')?.classList.add('scale-95', 'opacity-0');
        setTimeout(() => m.classList.add('hidden'), 300);
    }

})();