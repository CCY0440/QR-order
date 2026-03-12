// js/order.js
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // 1. 解析網址參數 (?store_id=xxx&table=桌號1)
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('store_id');
    const tableName = urlParams.get('table') || '未指定桌號';

    if (!storeId) {
        document.getElementById('menu-container').innerHTML = '<p class="text-center text-red-500 font-bold py-20">無效的點餐網址，找不到店家 ID。</p>';
        return;
    }

    // 更新桌號顯示
    document.getElementById('table-name').textContent = tableName;

    let allProducts = [];
    let cart = {}; // 購物車紀錄 { productId: quantity }

    try {
        // 2. 抓取店家基本資料
        const { data: store } = await window.supabaseClient.from('stores').select('name, logo_url').eq('id', storeId).single();
        if (store) {
            document.getElementById('store-name').textContent = store.name;
            if (store.logo_url) {
                const logoImg = document.getElementById('store-logo');
                logoImg.src = store.logo_url;
                logoImg.classList.remove('hidden');
                document.getElementById('store-logo-fallback').classList.add('hidden');
            }
        }

        // 3. 抓取有供應的餐點與分類
        const { data: products, error } = await window.supabaseClient
            .from('products')
            .select('*, categories(name)')
            .eq('store_id', storeId)
            .eq('is_available', true);

        if (error) throw error;
        allProducts = products || [];

        if (allProducts.length === 0) {
            document.getElementById('menu-container').innerHTML = '<p class="text-center text-gray-400 font-bold py-20">店家目前尚未供應任何餐點</p>';
            return;
        }

        // 4. 將餐點依照分類整理
        const groupedProducts = allProducts.reduce((acc, p) => {
            const catName = p.categories ? p.categories.name : '未分類';
            if (!acc[catName]) acc[catName] = [];
            acc[catName].push(p);
            return acc;
        }, {});

        // 5. 渲染分類導覽列
        const categoryNav = document.getElementById('category-nav');
        categoryNav.innerHTML = '';
        Object.keys(groupedProducts).forEach((catName, index) => {
            const btn = document.createElement('a');
            btn.href = `#cat-${index}`;
            btn.className = "px-4 py-1.5 whitespace-nowrap rounded-full font-bold text-sm bg-gray-50 text-gray-600 border border-gray-100 hover:bg-emerald-50 hover:text-emerald-600 transition-colors";
            btn.textContent = catName;
            categoryNav.appendChild(btn);
        });

        // 6. 渲染餐點列表
        let menuHtml = '';
        Object.entries(groupedProducts).forEach(([catName, items], index) => {
            menuHtml += `<div id="cat-${index}" class="pt-6 pb-2"><h2 class="text-lg font-black text-gray-800 mb-4 flex items-center gap-2"><span class="w-1 h-5 bg-emerald-500 rounded-full"></span>${catName}</h2><div class="space-y-4">`;

            items.forEach(p => {
                const imgHtml = p.image_url
                    ? `<img src="${p.image_url}" class="w-24 h-24 object-cover rounded-xl shrink-0 border border-gray-100">`
                    : `<div class="w-24 h-24 bg-gray-50 rounded-xl shrink-0 flex items-center justify-center border border-gray-100"><i data-lucide="utensils" class="w-8 h-8 text-gray-300"></i></div>`;

                const descHtml = p.description ? `<p class="text-xs text-gray-400 mt-1 line-clamp-2">${p.description}</p>` : '';

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
                                    <button class="w-7 h-7 flex items-center justify-center rounded-md bg-white text-gray-500 shadow-sm active:scale-95 btn-minus" data-id="${p.id}"><i data-lucide="minus" class="w-4 h-4"></i></button>
                                    <span class="font-bold text-gray-800 text-sm w-4 text-center qty-display" id="qty-${p.id}">0</span>
                                    <button class="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-500 text-white shadow-sm active:scale-95 btn-plus" data-id="${p.id}"><i data-lucide="plus" class="w-4 h-4"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            menuHtml += `</div></div>`;
        });
        document.getElementById('menu-container').innerHTML = menuHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // 7. 綁定購物車按鈕邏輯
        document.querySelectorAll('.btn-plus').forEach(btn => {
            btn.addEventListener('click', (e) => updateCart(e.currentTarget.dataset.id, 1));
        });
        document.querySelectorAll('.btn-minus').forEach(btn => {
            btn.addEventListener('click', (e) => updateCart(e.currentTarget.dataset.id, -1));
        });

    } catch (err) {
        console.error(err);
        document.getElementById('menu-container').innerHTML = '<p class="text-center text-red-500 font-bold py-20">載入失敗，請重新整理。</p>';
    }

    // 8. 購物車核心計算邏輯
    function updateCart(productId, change) {
        if (!cart[productId]) cart[productId] = 0;
        cart[productId] += change;
        if (cart[productId] < 0) cart[productId] = 0;

        // 更新單一餐點的數字顯示
        document.getElementById(`qty-${productId}`).textContent = cart[productId];

        // 計算總數量與總金額
        let totalCount = 0;
        let totalPrice = 0;

        Object.keys(cart).forEach(id => {
            if (cart[id] > 0) {
                totalCount += cart[id];
                const product = allProducts.find(p => p.id === id);
                if (product) totalPrice += (product.price * cart[id]);
            }
        });

        // 更新底部浮動列
        document.getElementById('cart-count').textContent = totalCount;
        document.getElementById('cart-total').textContent = totalPrice.toLocaleString(); // 加上千分位逗號

        const cartBar = document.getElementById('cart-bar');
        if (totalCount > 0) {
            cartBar.classList.remove('translate-y-full'); // 彈出購物車
        } else {
            cartBar.classList.add('translate-y-full'); // 隱藏購物車
        }
    }

    // 結帳按鈕 (先做假的特效)
    document.getElementById('btn-checkout').addEventListener('click', () => {
        alert('訂單建立功能即將上線！感謝您的預覽測試。');
    });
});