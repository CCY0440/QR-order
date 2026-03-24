// =============================================
// order.js — 顧客點餐頁 (終極版：明細顯示、加點次數限制與提示)
// =============================================
(async function () {
    const params = new URLSearchParams(location.search);
    const storeId = params.get('store_id');
    const tableName = decodeURIComponent(params.get('table') || '');

    if (!storeId) {
        document.getElementById('menu-container').innerHTML = '<p class="text-center text-red-500 font-bold py-20">連結無效</p>';
        return;
    }

    let allProducts = [];
    let cart = [];
    let currentProduct = null;
    let pmQty = 1;
    let realtimeChannel = null;
    let editingCartIndex = -1;
    let isSubmittingOrder = false;
    let allowAddon = true;

    // 🌟 共用：渲染客製化選項
    function renderItemOptions(options) {
        if (!options || typeof options !== 'object' || Object.keys(options).length === 0) return '';
        const parts = Object.values(options).map(opt => {
            if (opt.type === 'text') return `${opt.label}：${opt.value || ''}`;
            const choices = (opt.choices || []).map(c => c.label).join('、');
            return choices ? `${opt.label}：${choices}` : null;
        }).filter(Boolean);
        if (!parts.length) return '';
        return parts.map(p =>
            `<span class="text-[10px] text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-medium inline-block">${p}</span>`
        ).join(' ');
    }

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
        if (isSubmittingOrder) return;
        isSubmittingOrder = true;

        const btn = document.getElementById('btn-confirm-order');
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> 送出中...';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            const payment = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
            const note = document.getElementById('checkout-note')?.value.trim() || '';
            const total = cart.reduce((s, c) => s + c.lineTotal, 0);

            const activeOrders = JSON.parse(localStorage.getItem(`active_orders_${storeId}`) || '[]');

            let finalNote = note;
            if (activeOrders.length > 0) {
                finalNote = finalNote ? `【加點】 ${finalNote}` : '【加點】';
            }

            const { data: order, error } = await window.supabaseClient.from('orders').insert({
                store_id: storeId,
                table_name: tableName,
                status: 'pending',
                total_price: total,
                payment_method: payment,
                is_paid: false,
                note: finalNote
            }).select().single();

            if (error || !order) throw new Error('送出失敗');

            const finalDailyNumber = order.daily_number;

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

            activeOrders.push({ orderId: order.id, dailyNumber: finalDailyNumber });
            localStorage.setItem(`active_orders_${storeId}`, JSON.stringify(activeOrders));

            window.renderTrackingPage();

        } catch (error) {
            alert('送出失敗，請重試');
        } finally {
            setTimeout(() => {
                isSubmittingOrder = false;
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5"></i> 送出訂單 · NT$ <span id="checkout-total">0</span>';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 500);
        }
    });

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

    // ── 5. 訂單追蹤 (🌟 動態渲染多張訂單卡片 + 明細顯示) ──
    window.renderTrackingPage = async function () {
        let activeOrders = JSON.parse(localStorage.getItem(`active_orders_${storeId}`) || '[]');
        if (activeOrders.length === 0) return;

        // 🌟 額外抓取 order_items 顯示餐點明細
        const { data: dbOrders } = await window.supabaseClient
            .from('orders')
            // 👇 補上 total_price 欄位！
            .select('id, daily_number, status, note, created_at, total_price, order_items(product_name, quantity, subtotal, options)')
            .in('id', activeOrders.map(o => o.orderId))
            .order('created_at', { ascending: true });

        if (!dbOrders || dbOrders.length === 0) {
            localStorage.removeItem(`active_orders_${storeId}`);
            return;
        }

        const mainHeader = document.querySelector('header');
        const mainContent = document.querySelector('.max-w-6xl');
        const mobileCart = document.getElementById('cart-bar');

        if (mainHeader) mainHeader.classList.add('hidden');
        if (mainContent) mainContent.classList.add('hidden');
        if (mobileCart) mobileCart.classList.add('hidden');

        const existingTracking = document.getElementById('tracking-page');
        if (existingTracking) existingTracking.remove();
        const existingFloatBtn = document.getElementById('floating-tracking-btn');
        if (existingFloatBtn) existingFloatBtn.remove();

        if (realtimeChannel) { window.supabaseClient.removeChannel(realtimeChannel); }

        // 🌟 限制只能加點 1 次 (主單 + 加點單 = 最多 2 單)
        const hideAddonBtn = !allowAddon || activeOrders.length >= 2;

        let cardsHtml = dbOrders.map((o, idx) => {
            const isAddOn = idx > 0;
            const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
            const badgeHtml = isAddOn
                ? `<span class="text-xs font-bold bg-red-50 text-red-500 border border-red-100 px-2 py-1 rounded-lg shadow-sm">加點單</span>`
                : `<span class="text-xs font-bold bg-blue-50 text-blue-500 border border-blue-100 px-2 py-1 rounded-lg shadow-sm">主單</span>`;

            let descHtml = '請到櫃檯付款，完成後廚房即開始製作';
            if (o.status === 'cancelled') {
                descHtml = `很抱歉，此訂單已被取消。<button onclick="window.removeOrderCard('${o.id}')" class="mt-3 w-full py-2.5 bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 rounded-xl font-bold transition-all active:scale-95 text-sm flex justify-center items-center gap-1.5"><i data-lucide="x" class="w-4 h-4"></i> 移除此單並重新點餐</button>`;
            } else if (o.status === 'confirmed') descHtml = '付款已確認！<br>廚房馬上開始為您準備 ✅';
            else if (o.status === 'preparing') descHtml = '廚師正在精心製作您的餐點 🍳';
            else if (o.status === 'ready') descHtml = '餐點已準備好，請至櫃檯領取！';
            else if (o.status === 'completed') descHtml = '感謝您的光臨，祝您用餐愉快！';

            const currentStep = steps.indexOf(o.status);
            const pct = currentStep > 0 ? (currentStep / (steps.length - 1)) * 100 : 0;

            // 🌟 渲染每張卡片底下的餐點明細 (加入金額顯示)
            const itemsHtml = (o.order_items || []).map(item => {
                const optHtml = renderItemOptions(item.options);
                return `
                <div class="flex items-start justify-between py-2 border-b border-gray-200/60 last:border-0">
                    <div class="flex-1 pr-2 min-w-0">
                        <p class="font-bold text-gray-700 text-sm">${item.product_name}</p>
                        ${optHtml ? `<div class="flex flex-wrap gap-1 mt-1">${optHtml}</div>` : ''}
                    </div>
                    <div class="flex items-center gap-3 shrink-0 mt-0.5">
                        <span class="text-gray-400 font-mono text-xs">×${item.quantity}</span>
                        <span class="font-bold text-gray-800 w-16 text-right text-xs">NT$ ${(item.subtotal || 0).toLocaleString()}</span>
                    </div>
                </div>`;
            }).join('');

            return `
            <div class="mb-5 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 relative overflow-hidden" id="track-card-${o.id}">
                <div class="flex justify-between items-center mb-5">
                    <div class="flex items-baseline gap-2">
                        <span class="text-sm font-bold text-gray-400">取餐號</span>
                        <span class="font-black text-2xl text-emerald-600 tracking-wider">#${String(o.daily_number).padStart(3, '0')}</span>
                    </div>
                    ${badgeHtml}
                </div>
                
                <div class="flex items-center gap-5 mb-6">
                    <div id="status-icon-wrap-${o.id}" class="w-16 h-16 shrink-0 rounded-full flex items-center justify-center transition-all duration-500 ${cfg.bg} border-4 ${cfg.border}">
                        <i id="status-icon-${o.id}" data-lucide="${cfg.icon}" class="w-8 h-8 ${cfg.color}"></i>
                    </div>
                    <div>
                        <h2 id="status-label-${o.id}" class="text-xl font-black text-gray-800">${cfg.label}</h2>
                        <div id="status-desc-${o.id}" class="text-xs font-bold text-gray-500 mt-1.5 leading-relaxed">${descHtml}</div>
                    </div>
                </div>

                <div class="relative flex justify-between px-1 mt-2 mb-6">
                    <div class="absolute left-3 right-3 top-3 h-1.5 bg-gray-100 rounded-full -z-0">
                        <div id="progress-fill-${o.id}" class="h-full bg-emerald-400 rounded-full transition-all duration-700" style="width:${pct}%"></div>
                    </div>
                    ${steps.map((s, i) => {
                let dotClass = 'bg-white border-gray-200 text-gray-400';
                let lblClass = 'text-gray-400';
                let dotContent = i + 1;
                if (i < currentStep) {
                    dotClass = 'bg-emerald-500 border-emerald-500 text-white';
                    dotContent = '<i data-lucide="check" class="w-3.5 h-3.5"></i>';
                    lblClass = 'text-emerald-500';
                } else if (i === currentStep) {
                    dotClass = `${cfg.bg} ${cfg.border} ${cfg.color}`;
                    lblClass = `${cfg.color}`;
                }
                return `
                        <div class="flex flex-col items-center gap-2 z-10">
                            <div id="step-dot-${o.id}-${i}" class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-[3px] transition-all duration-500 ${dotClass}">${dotContent}</div>
                            <span id="step-label-${o.id}-${i}" class="text-[10px] font-bold whitespace-nowrap ${lblClass}">${stepLabels[i]}</span>
                        </div>`
            }).join('')}
                </div>

                <div class="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <p class="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">餐點明細</p>
                    <div class="flex flex-col">
                        ${itemsHtml}
                    </div>
                    <div class="flex justify-between items-center pt-3 mt-2 border-t border-gray-200/80">
                        <span class="font-bold text-gray-600 text-sm">小計</span>
                        <span class="font-black text-lg text-gray-800">NT$ ${(o.total_price || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        // 🌟 溫馨提醒文字：已加點 / 還可加點
        let topNoticeHtml = '';
        if (activeOrders.length >= 2) {
            topNoticeHtml = `<div class="bg-red-50 border border-red-200 text-red-600 text-[13px] font-bold px-4 py-3 rounded-2xl flex items-center gap-2 mb-4 shadow-sm"><i data-lucide="alert-circle" class="w-5 h-5 shrink-0 text-red-500"></i>您已使用過加點功能，每筆訂單僅限加點一次喔！</div>`;
        } else if (activeOrders.length === 1 && allowAddon) {
            topNoticeHtml = `<div class="bg-blue-50 border border-blue-200 text-blue-600 text-[13px] font-bold px-4 py-3 rounded-2xl flex items-center gap-2 mb-4 shadow-sm"><i data-lucide="info" class="w-5 h-5 shrink-0 text-blue-500"></i>💡 若有需要，您還可以再加點一次餐點喔！</div>`;
        }

        const html = `
        <div id="tracking-page" class="fixed inset-0 z-[9999] bg-[#f8fafc] flex flex-col overflow-y-auto">
            <div class="w-full max-w-md mx-auto min-h-screen flex flex-col relative pb-10">
                <div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                    <h3 class="font-black text-gray-800 text-lg tracking-wide">訂單進度</h3>
                    <button id="btn-back-to-menu" class="text-sm font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 active:scale-95 transition-all flex items-center gap-1 ${hideAddonBtn ? 'hidden' : ''}">
                        <i data-lucide="plus" class="w-4 h-4"></i> 加點餐點
                    </button>
                </div>
                <div class="flex-1 p-5 flex flex-col mt-2" id="tracking-cards-container">
                    ${topNoticeHtml}
                    ${cardsHtml}
                </div>
            </div>
        </div>

        <button id="floating-tracking-btn" class="fixed bottom-24 right-4 z-[40] bg-amber-500 hover:bg-amber-600 text-white p-3.5 rounded-full shadow-lg shadow-amber-500/30 transition-all active:scale-95 hidden group">
            <i data-lucide="bell-ring" class="w-6 h-6 animate-pulse"></i>
            <span class="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">查看進度</span>
        </button>

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

        // 綁定按鈕
        const backBtn = document.getElementById('btn-back-to-menu');
        if (backBtn) {
            backBtn.onclick = () => {
                document.getElementById('tracking-page').classList.add('hidden');
                if (mainHeader) mainHeader.classList.remove('hidden');
                if (mainContent) mainContent.classList.remove('hidden');
                if (mobileCart) mobileCart.classList.remove('hidden');
                document.getElementById('floating-tracking-btn').classList.remove('hidden');
                updateCartUI();
                window.onpopstate = null;
            };
        }

        document.getElementById('floating-tracking-btn').onclick = () => {
            document.getElementById('tracking-page').classList.remove('hidden');
            if (mainHeader) mainHeader.classList.add('hidden');
            if (mainContent) mainContent.classList.add('hidden');
            if (mobileCart) mobileCart.classList.add('hidden');
            document.getElementById('floating-tracking-btn').classList.add('hidden');
            setupBackLock();
        };

        function setupBackLock() {
            window.location.hash = 'tracking';
            window.onpopstate = function () {
                if (window.location.hash !== '#tracking') {
                    window.location.hash = 'tracking';
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
        }
        setupBackLock();

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

        // 監聽所有活躍的訂單
        realtimeChannel = window.supabaseClient
            .channel('orders-tracking-multi')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
                payload => {
                    let currentActive = JSON.parse(localStorage.getItem(`active_orders_${storeId}`) || '[]');
                    if (currentActive.some(o => o.orderId === payload.new.id)) {
                        updateSingleStatusUI(payload.new.id, payload.new.status);
                    }
                })
            .subscribe();
    };

    window.removeOrderCard = function (orderId) {
        let activeOrders = JSON.parse(localStorage.getItem(`active_orders_${storeId}`) || '[]');
        activeOrders = activeOrders.filter(o => o.orderId !== orderId);
        localStorage.setItem(`active_orders_${storeId}`, JSON.stringify(activeOrders));

        const card = document.getElementById(`track-card-${orderId}`);
        if (card) {
            card.classList.add('opacity-0', 'scale-95');
            setTimeout(() => card.remove(), 300);
        }

        if (activeOrders.length === 0) {
            window.onpopstate = null;
            localStorage.removeItem(`active_orders_${storeId}`);
            document.getElementById('tracking-page')?.classList.add('hidden');
            document.querySelector('header')?.classList.remove('hidden');
            document.querySelector('.max-w-6xl')?.classList.remove('hidden');
            document.getElementById('cart-bar')?.classList.remove('hidden');
            document.getElementById('floating-tracking-btn')?.classList.add('hidden');
            cart = []; updateCartUI();
        }
    };

    function updateSingleStatusUI(orderId, status) {
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        const currentStep = steps.indexOf(status);

        const iconWrap = document.getElementById(`status-icon-wrap-${orderId}`);
        if (!iconWrap) return;

        const icon = document.getElementById(`status-icon-${orderId}`);
        const label = document.getElementById(`status-label-${orderId}`);
        const desc = document.getElementById(`status-desc-${orderId}`);
        const fill = document.getElementById(`progress-fill-${orderId}`);

        iconWrap.className = `w-16 h-16 shrink-0 rounded-full flex items-center justify-center transition-all duration-500 ${cfg.bg} border-4 ${cfg.border}`;
        icon.setAttribute('data-lucide', cfg.icon);
        icon.className = `w-8 h-8 ${cfg.color}`;
        label.textContent = cfg.label;

        if (status === 'cancelled') {
            desc.innerHTML = `很抱歉，此訂單已被取消。<button onclick="window.removeOrderCard('${orderId}')" class="mt-3 w-full py-2.5 bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 rounded-xl font-bold transition-all active:scale-95 text-sm flex justify-center items-center gap-1.5"><i data-lucide="x" class="w-4 h-4"></i> 移除此單並重新點餐</button>`;
        } else if (status === 'confirmed') desc.innerHTML = '付款已確認！<br>廚房馬上開始為您準備 ✅';
        else if (status === 'preparing') desc.innerHTML = '廚師正在精心製作您的餐點 🍳';
        else if (status === 'ready') desc.innerHTML = '餐點已準備好，請至櫃檯領取！';
        else if (status === 'completed') desc.innerHTML = '感謝您的光臨，祝您用餐愉快！';

        const pct = currentStep > 0 ? (currentStep / (steps.length - 1)) * 100 : 0;
        fill.style.width = pct + '%';

        steps.forEach((s, i) => {
            const dot = document.getElementById(`step-dot-${orderId}-${i}`);
            const lbl = document.getElementById(`step-label-${orderId}-${i}`);
            if (!dot) return;

            if (i < currentStep) {
                dot.className = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-[3px] transition-all duration-500 bg-emerald-500 border-emerald-500 text-white';
                dot.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i>';
                lbl.className = 'text-[10px] font-bold text-emerald-500 whitespace-nowrap';
            } else if (i === currentStep) {
                dot.className = `w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-[3px] transition-all duration-500 ${cfg.bg} ${cfg.border} ${cfg.color}`;
                dot.textContent = i + 1;
                lbl.className = `text-[10px] font-black whitespace-nowrap ${cfg.color}`;
            } else {
                dot.className = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-[3px] transition-all duration-500 bg-white border-gray-200 text-gray-400';
                dot.textContent = i + 1;
                lbl.className = 'text-[10px] font-bold text-gray-400 whitespace-nowrap';
            }
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();

        if (status === 'completed') {
            setTimeout(() => { window.removeOrderCard(orderId); }, 3000);
        }
    }

    function subscribeRealtime() {
        window.supabaseClient
            .channel('order-store-status')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${storeId}` },
                payload => {
                    if (payload.new.is_open === false) document.getElementById('closed-overlay').classList.remove('hidden');
                    else document.getElementById('closed-overlay').classList.add('hidden');

                    if (payload.new.allow_addon !== undefined) {
                        allowAddon = payload.new.allow_addon;
                        const backBtn = document.getElementById('btn-back-to-menu');
                        if (backBtn) {
                            if (!allowAddon) backBtn.classList.add('hidden');
                            else backBtn.classList.remove('hidden');
                        }
                    }
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

    function migrateLocalStorage() {
        const oldData = localStorage.getItem(`active_order_${storeId}`);
        if (oldData) {
            try {
                const parsed = JSON.parse(oldData);
                localStorage.setItem(`active_orders_${storeId}`, JSON.stringify([parsed]));
                localStorage.removeItem(`active_order_${storeId}`);
            } catch (e) { }
        }
    }

    async function init() {
        document.getElementById('table-badge').textContent = tableName;

        const { data: store } = await window.supabaseClient
            .from('stores').select('name, logo_url, description, is_open, allow_addon').eq('id', storeId).single();

        if (!store) { document.getElementById('menu-container').innerHTML = '<p class="text-center text-gray-500 py-20">找不到店家</p>'; return; }

        document.title = store.name + ' · 點餐';
        document.getElementById('store-name').textContent = store.name;
        document.getElementById('closed-name').textContent = store.name;

        allowAddon = store.allow_addon !== false;

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

        migrateLocalStorage();

        const activeOrdersJson = localStorage.getItem(`active_orders_${storeId}`);
        if (activeOrdersJson) {
            try {
                const activeOrders = JSON.parse(activeOrdersJson);
                if (activeOrders.length > 0) {
                    window.renderTrackingPage();
                }
            } catch (e) {
                localStorage.removeItem(`active_orders_${storeId}`);
            }
        }

        await loadMenu();
        subscribeRealtime();
        lucide.createIcons();
    }

    init();
})();