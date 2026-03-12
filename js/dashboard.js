// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // ==========================================
    // 🌟 全域客製化對話框系統 (AppDialog)
    // ==========================================
    window.AppDialog = {
        show: function (options) {
            return new Promise((resolve) => {
                const modal = document.getElementById('modal-dialog');
                const content = document.getElementById('modal-dialog-content');
                const title = document.getElementById('dialog-title');
                const msg = document.getElementById('dialog-message');
                const btnConfirm = document.getElementById('btn-dialog-confirm');
                const btnCancel = document.getElementById('btn-dialog-cancel');
                const icon = document.getElementById('dialog-icon');
                const iconContainer = document.getElementById('dialog-icon-container');

                title.textContent = options.title || '提示';
                msg.textContent = options.message || '';

                // 設定主題顏色與圖示
                if (options.type === 'danger') {
                    icon.setAttribute('data-lucide', 'alert-triangle');
                    iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 bg-red-100 text-red-600';
                    btnConfirm.className = 'flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-red-500/20 active:scale-95';
                } else if (options.type === 'warning') {
                    icon.setAttribute('data-lucide', 'info');
                    iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 bg-yellow-100 text-yellow-600';
                    btnConfirm.className = 'flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95';
                } else {
                    icon.setAttribute('data-lucide', 'check-circle-2');
                    iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 bg-emerald-100 text-emerald-600';
                    btnConfirm.className = 'flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95';
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();

                if (options.showCancel) btnCancel.classList.remove('hidden');
                else btnCancel.classList.add('hidden');

                // 動畫開啟
                modal.classList.remove('hidden');
                setTimeout(() => {
                    modal.classList.remove('opacity-0');
                    content.classList.remove('scale-95', 'opacity-0');
                }, 10);

                // 綁定按鈕事件
                const closeAndResolve = (result) => {
                    modal.classList.add('opacity-0');
                    content.classList.add('scale-95', 'opacity-0');
                    setTimeout(() => {
                        modal.classList.add('hidden');
                        resolve(result);
                    }, 300);
                    btnConfirm.onclick = null;
                    btnCancel.onclick = null;
                };

                btnConfirm.onclick = () => closeAndResolve(true);
                btnCancel.onclick = () => closeAndResolve(false);
            });
        },
        alert: function (message, type = 'warning', title = '提示') {
            return this.show({ message, type, title, showCancel: false });
        },
        confirm: function (message, type = 'danger', title = '請確認') {
            return this.show({ message, type, title, showCancel: true });
        }
    };

    // ==========================================
    // 側邊欄與 SPA 切換邏輯 (維持不變)
    // ==========================================
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar');
    const closeBtn = document.getElementById('close-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        if (!sidebar) return;
        if (sidebar.classList.contains('translate-x-0')) {
            sidebar.classList.remove('translate-x-0');
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        } else {
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.add('translate-x-0');
            if (overlay) overlay.classList.remove('hidden');
        }
    }
    if (openBtn) openBtn.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    const headerTitle = document.getElementById('header-title');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            const newTitle = link.getAttribute('data-title');

            navLinks.forEach(nav => {
                nav.classList.remove('bg-emerald-50', 'text-emerald-600', 'font-bold', 'active');
                nav.classList.add('text-gray-500', 'hover:bg-gray-50', 'hover:text-gray-800', 'font-medium');
            });
            link.classList.remove('text-gray-500', 'hover:bg-gray-50', 'hover:text-gray-800', 'font-medium');
            link.classList.add('bg-emerald-50', 'text-emerald-600', 'font-bold', 'active');

            contentSections.forEach(section => {
                section.classList.add('hidden');
                section.classList.remove('fade-in');
            });

            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('hidden');
                void targetSection.offsetWidth;
                targetSection.classList.add('fade-in');
            }
            if (headerTitle) headerTitle.textContent = newTitle;
            if (targetId === 'section-menu') loadMenu();
            if (targetId === 'section-tables' && typeof window.loadTables === 'function') window.loadTables();
            if (targetId === 'section-settings') loadSettings();
            if (targetId === 'section-orders' && typeof window.loadOrders === 'function') window.loadOrders();
            if (targetId === 'section-reports' && typeof window.loadReports === 'function') window.loadReports();
            if (targetId === 'section-employees' && typeof window.loadStaff === 'function') window.loadStaff();
            if (window.innerWidth < 1024) toggleSidebar();
        });
    });

    const orderTabs = document.querySelectorAll('.order-tab');
    orderTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            orderTabs.forEach(t => {
                t.classList.remove('bg-white', 'text-emerald-600', 'shadow-sm', 'active');
                t.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-100');
            });
            tab.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-100');
            tab.classList.add('bg-white', 'text-emerald-600', 'shadow-sm', 'active');
        });
    });

    let allProducts = [];
    let editingProductId = null;

    // ==========================================
    // 載入與渲染大菜單 (維持不變)
    // ==========================================
    async function loadMenu() {
        const container = document.getElementById('menu-list-container');
        if (!container) return;

        try {
            const storeId = await getStoreId();
            if (!storeId) return;

            const { data: products, error } = await window.supabaseClient.from('products').select('*, categories(name)').eq('store_id', storeId);
            if (error) throw error;

            allProducts = products || [];

            if (allProducts.length === 0) {
                container.innerHTML = `<div class="text-center py-16"><div class="w-16 h-16 bg-gray-50 text-gray-300 rounded-2xl flex items-center justify-center mx-auto mb-4"><i data-lucide="inbox" class="w-8 h-8"></i></div><h4 class="font-bold text-gray-700 text-lg mb-1">目前還沒有任何餐點</h4><p class="text-sm text-gray-500">點擊右上角的「新增餐點」來豐富您的菜單吧！</p></div>`;
                lucide.createIcons();
                return;
            }

            const groupedProducts = allProducts.reduce((acc, p) => {
                const catName = p.categories ? p.categories.name : '未分類';
                if (!acc[catName]) acc[catName] = [];
                acc[catName].push(p);
                return acc;
            }, {});

            let html = '<div class="space-y-8">';
            for (const [category, items] of Object.entries(groupedProducts)) {
                html += `<div><h3 class="font-bold text-gray-700 text-lg mb-3 flex items-center gap-2"><span class="w-1.5 h-5 bg-emerald-500 rounded-full inline-block"></span>${category} <span class="text-sm font-normal text-gray-400">(${items.length} 項)</span></h3><div class="border border-gray-100 rounded-xl overflow-hidden shadow-sm"><table class="w-full text-left text-sm bg-white"><thead class="bg-gray-50/80 border-b border-gray-100 text-gray-500"><tr><th class="p-3 pl-5 font-medium">餐點名稱</th><th class="p-3 font-medium">價格</th><th class="p-3 font-medium">狀態</th><th class="p-3 text-right pr-5 font-medium">操作</th></tr></thead><tbody class="divide-y divide-gray-50">`;

                items.forEach(p => {
                    const statusHtml = p.is_available ? '<span class="px-2 py-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-md border border-emerald-100">供應中</span>' : '<span class="px-2 py-1 bg-gray-50 text-gray-500 text-[11px] font-bold rounded-md border border-gray-100">已停售</span>';
                    html += `<tr class="hover:bg-gray-50/50 transition-colors group"><td class="p-3 pl-5 font-bold text-gray-800">${p.name}</td><td class="p-3 font-mono text-gray-600">NT$ ${p.price}</td><td class="p-3">${statusHtml}</td><td class="p-3 text-right pr-5 opacity-0 group-hover:opacity-100 transition-opacity"><button onclick="editProduct('${p.id}')" class="text-gray-400 hover:text-emerald-600 p-1.5 rounded transition-colors" title="編輯"><i data-lucide="edit-3" class="w-4 h-4"></i></button><button onclick="deleteProduct('${p.id}', '${p.name}', '${p.image_url || ''}')" class="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors" title="刪除"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`;
                });
                html += `</tbody></table></div></div>`;
            }
            html += '</div>';
            container.innerHTML = html;
            lucide.createIcons();

        } catch (err) {
            container.innerHTML = '<p class="text-center text-red-500 py-10 font-bold">載入失敗，請檢查網路連線。</p>';
        }
    }

    // ==========================================
    // 刪除與預覽功能 (升級為自訂提示框)
    // ==========================================
    window.deleteProduct = async (id, name, imageUrl) => {
        const confirmed = await AppDialog.confirm(`確定要刪除餐點「${name}」嗎？\n(此動作無法復原)`, 'danger', '刪除餐點');
        if (!confirmed) return;

        try {
            const { error } = await window.supabaseClient.from('products').delete().eq('id', id);
            if (error) throw error;
            if (imageUrl) {
                const filePath = imageUrl.split('/product-images/')[1];
                if (filePath) await window.supabaseClient.storage.from('product-images').remove([filePath]);
            }
            loadMenu();
        } catch (err) {
            AppDialog.alert('刪除失敗：' + err.message, 'danger');
        }
    };

    const btnPreviewMenu = document.getElementById('btn-preview-menu');
    if (btnPreviewMenu) {
        btnPreviewMenu.addEventListener('click', async () => {
            const storeId = await getStoreId();
            if (storeId) {
                const baseUrl = window.location.origin + window.location.pathname.replace('dashboard.html', 'order.html');
                window.open(`${baseUrl}?store_id=${storeId}&table=預覽模式`, '_blank');
            } else {
                AppDialog.alert('無法取得店家資訊，請重試。', 'warning');
            }
        });
    }

    // ==========================================
    // 分類管理 Modal
    // ==========================================
    const modalCategory = document.getElementById('modal-category');
    const modalCategoryContent = document.getElementById('modal-category-content');
    const btnManageCategories = document.getElementById('btn-manage-categories');
    const btnCloseCategoryModal = document.getElementById('btn-close-category-modal');
    const categoryListContainer = document.getElementById('category-list-container');
    const btnAddCategory = document.getElementById('btn-add-category');
    const inputNewCategory = document.getElementById('input-new-category');
    let cachedStoreId = null;

    async function getStoreId() {
        if (cachedStoreId) return cachedStoreId;
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return null;
        const { data: store } = await window.supabaseClient.from('stores').select('id').eq('owner_id', user.id).single();
        if (store) cachedStoreId = store.id;
        return cachedStoreId;
    }

    function toggleCategoryModal(show) {
        if (show) {
            modalCategory.classList.remove('hidden');
            setTimeout(() => {
                modalCategory.classList.remove('opacity-0');
                modalCategoryContent.classList.remove('scale-95', 'opacity-0');
            }, 10);
            loadCategories();
        } else {
            modalCategory.classList.add('opacity-0');
            modalCategoryContent.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modalCategory.classList.add('hidden');
                loadMenu();
            }, 300);
        }
    }

    if (btnManageCategories) btnManageCategories.addEventListener('click', () => toggleCategoryModal(true));
    if (btnCloseCategoryModal) btnCloseCategoryModal.addEventListener('click', () => toggleCategoryModal(false));

    async function loadCategories() {
        if (!categoryListContainer) return;
        const storeId = await getStoreId();
        if (!storeId) return;

        categoryListContainer.innerHTML = '<div class="flex justify-center py-6"><i data-lucide="loader" class="w-6 h-6 text-emerald-500 animate-spin"></i></div>';

        const { data: categories, error } = await window.supabaseClient.from('categories').select('*').eq('store_id', storeId);

        if (error || categories.length === 0) {
            categoryListContainer.innerHTML = '<p class="text-center text-gray-400 text-sm py-4 border-2 border-dashed border-gray-100 rounded-xl">目前沒有任何分類</p>';
            return;
        }

        let html = '';
        categories.forEach(cat => {
            html += `<div class="flex items-center justify-between bg-white border border-gray-100 p-3 pl-4 rounded-xl shadow-sm hover:border-emerald-200 transition-colors group"><span class="font-bold text-gray-700">${cat.name}</span><button onclick="deleteCategory('${cat.id}', '${cat.name}')" class="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`;
        });
        categoryListContainer.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    if (btnAddCategory) {
        btnAddCategory.addEventListener('click', async () => {
            const name = inputNewCategory.value.trim();
            if (!name) return AppDialog.alert('請先輸入分類名稱！', 'warning');
            const storeId = await getStoreId();
            if (!storeId) return;

            const originalText = btnAddCategory.innerHTML;
            btnAddCategory.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin mx-auto"></i>';
            const { error } = await window.supabaseClient.from('categories').insert([{ store_id: storeId, name: name }]);
            btnAddCategory.innerHTML = originalText;

            if (error) AppDialog.alert('新增失敗：' + error.message, 'danger');
            else { inputNewCategory.value = ''; loadCategories(); }
        });
    }

    window.deleteCategory = async (id, name) => {
        const confirmed = await AppDialog.confirm(`確定要刪除「${name}」嗎？\n\n⚠️ 嚴重警告：這會同時刪除該分類下的【所有餐點】！`, 'danger', '刪除分類');
        if (!confirmed) return;
        const { error } = await window.supabaseClient.from('categories').delete().eq('id', id);
        if (error) AppDialog.alert('刪除失敗：' + error.message, 'danger');
        else loadCategories();
    };

    // ==========================================
    // 新增/編輯餐點 Modal (🌟 升級自訂下拉選單)
    // ==========================================
    const modalProduct = document.getElementById('modal-product');
    const modalProductContent = document.getElementById('modal-product-content');
    const btnCreateProduct = document.getElementById('btn-create-product');
    const btnCloseProductModal = document.getElementById('btn-close-product-modal');
    const btnCancelProduct = document.getElementById('btn-cancel-product');
    const btnSaveProduct = document.getElementById('btn-save-product');

    const inputProductName = document.getElementById('input-product-name');
    const inputProductPrice = document.getElementById('input-product-price');
    const selectProductCategory = document.getElementById('select-product-category'); // 隱藏的真實 select
    const inputProductDesc = document.getElementById('input-product-desc');

    const productUploadArea = document.getElementById('product-image-upload-area');
    const productFileInput = document.getElementById('product-file-input');
    const productImgPreview = document.getElementById('product-image-preview');
    const productUploadPlaceholder = document.getElementById('product-upload-placeholder');
    const btnRemoveProductImage = document.getElementById('btn-remove-product-image');

    let currentProductImageFile = null;

    // 🌟 自訂下拉選單的互動邏輯
    const customSelectBtn = document.getElementById('custom-select-btn');
    const customSelectText = document.getElementById('custom-select-text');
    const customSelectOptions = document.getElementById('custom-select-options');
    const customSelectIcon = document.getElementById('custom-select-icon');

    // 點擊空白處自動關閉下拉選單
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('custom-select-wrapper');
        if (wrapper && !wrapper.contains(e.target) && customSelectOptions) {
            customSelectOptions.classList.add('hidden', 'opacity-0', '-translate-y-2');
            if (customSelectIcon) customSelectIcon.classList.remove('rotate-180');
        }
    });

    if (customSelectBtn) {
        customSelectBtn.addEventListener('click', () => {
            const isHidden = customSelectOptions.classList.contains('hidden');
            if (isHidden) {
                customSelectOptions.classList.remove('hidden');
                setTimeout(() => customSelectOptions.classList.remove('opacity-0', '-translate-y-2'), 10);
                customSelectIcon.classList.add('rotate-180');
            } else {
                customSelectOptions.classList.add('opacity-0', '-translate-y-2');
                customSelectIcon.classList.remove('rotate-180');
                setTimeout(() => customSelectOptions.classList.add('hidden'), 200);
            }
        });
    }

    function resetProductForm() {
        editingProductId = null;
        inputProductName.value = '';
        inputProductPrice.value = '';
        selectProductCategory.value = '';
        window._selectedCategoryId = '';
        inputProductDesc.value = '';

        // 恢復自訂選單外觀
        customSelectText.textContent = '請選擇分類...';
        customSelectText.classList.add('text-gray-400');
        customSelectText.classList.remove('text-gray-800');

        currentProductImageFile = null;
        productImgPreview.src = '';
        productImgPreview.dataset.oldUrl = '';
        productImgPreview.classList.add('hidden');
        productUploadPlaceholder.classList.remove('hidden');
        btnRemoveProductImage.classList.add('hidden');
        productFileInput.value = '';

        document.querySelector('#modal-product h3').innerHTML = '<i data-lucide="utensils-crossed" class="w-5 h-5 text-emerald-500"></i> 新增餐點';
        btnSaveProduct.innerHTML = '儲存上架';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function toggleProductModal(show) {
        if (show) {
            modalProduct.classList.remove('hidden');
            setTimeout(() => {
                modalProduct.classList.remove('opacity-0');
                modalProductContent.classList.remove('scale-95', 'opacity-0');
            }, 10);
            if (!editingProductId) populateCategorySelect();
        } else {
            modalProduct.classList.add('opacity-0');
            modalProductContent.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modalProduct.classList.add('hidden');
                resetProductForm();
            }, 300);
        }
    }

    if (btnCreateProduct) btnCreateProduct.addEventListener('click', () => toggleProductModal(true));
    if (btnCloseProductModal) btnCloseProductModal.addEventListener('click', () => toggleProductModal(false));
    if (btnCancelProduct) btnCancelProduct.addEventListener('click', () => toggleProductModal(false));

    // 🌟 將分類資料塞入自訂下拉選單
    async function populateCategorySelect() {
        const storeId = await getStoreId();
        if (!storeId) return;
        const { data: categories } = await window.supabaseClient.from('categories').select('id, name').eq('store_id', storeId);

        if (categories && categories.length > 0) {
            let optionsHtml = '<div class="py-1.5">';
            categories.forEach(c => {
                optionsHtml += `<button type="button" class="w-full text-left px-5 py-3 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors border-b border-gray-50 last:border-0" data-value="${c.id}">${c.name}</button>`;
            });
            optionsHtml += '</div>';
            customSelectOptions.innerHTML = optionsHtml;

            // 綁定點擊事件
            const customOptions = customSelectOptions.querySelectorAll('button');
            customOptions.forEach(opt => {
                opt.addEventListener('click', (e) => {
                    const val = e.target.getAttribute('data-value');
                    // 同步到隱藏的真實 select 並存到全域變數（兩種方式確保有效）
                    selectProductCategory.value = val;
                    window._selectedCategoryId = val;

                    // 更新畫面上顯示的文字
                    customSelectText.textContent = e.target.textContent;
                    customSelectText.classList.remove('text-gray-400');
                    customSelectText.classList.add('text-gray-800', 'font-medium');

                    // 收起選單
                    customSelectOptions.classList.add('opacity-0', '-translate-y-2');
                    customSelectIcon.classList.remove('rotate-180');
                    setTimeout(() => customSelectOptions.classList.add('hidden'), 200);
                });
            });
        } else {
            customSelectOptions.innerHTML = '<div class="p-4 text-sm text-gray-400 text-center">請先去建立分類</div>';
        }
    }

    window.editProduct = async (id) => {
        const product = allProducts.find(p => p.id === id);
        if (!product) return;
        editingProductId = product.id;

        inputProductName.value = product.name;
        inputProductPrice.value = product.price;
        inputProductDesc.value = product.description || '';

        await populateCategorySelect();
        selectProductCategory.value = product.category_id;

        // 設定自訂選單的預設文字
        const categoryName = product.categories ? product.categories.name : '未知分類';
        customSelectText.textContent = categoryName;
        customSelectText.classList.remove('text-gray-400');
        customSelectText.classList.add('text-gray-800', 'font-medium');

        if (product.image_url) {
            productImgPreview.src = product.image_url;
            productImgPreview.dataset.oldUrl = product.image_url;
            productImgPreview.classList.remove('hidden');
            productUploadPlaceholder.classList.add('hidden');
            btnRemoveProductImage.classList.remove('hidden');
        }

        document.querySelector('#modal-product h3').innerHTML = '<i data-lucide="edit" class="w-5 h-5 text-emerald-500"></i> 編輯餐點';
        btnSaveProduct.innerHTML = '<i data-lucide="save" class="w-5 h-5"></i> 儲存修改';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        modalProduct.classList.remove('hidden');
        setTimeout(() => {
            modalProduct.classList.remove('opacity-0');
            modalProductContent.classList.remove('scale-95', 'opacity-0');
        }, 10);
    };

    if (productUploadArea && productFileInput) {
        productUploadArea.addEventListener('click', () => productFileInput.click());
        productFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            currentProductImageFile = file;

            const reader = new FileReader();
            reader.onload = (ev) => {
                productImgPreview.src = ev.target.result;
                productImgPreview.classList.remove('hidden');
                productUploadPlaceholder.classList.add('hidden');
                btnRemoveProductImage.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnRemoveProductImage) {
        btnRemoveProductImage.addEventListener('click', (e) => {
            e.stopPropagation();
            currentProductImageFile = null;
            productImgPreview.src = '';
            productImgPreview.dataset.oldUrl = '';
            productImgPreview.classList.add('hidden');
            productUploadPlaceholder.classList.remove('hidden');
            btnRemoveProductImage.classList.add('hidden');
            productFileInput.value = '';
        });
    }

    if (btnSaveProduct) {
        btnSaveProduct.addEventListener('click', async () => {
            const name = inputProductName.value.trim();
            const price = parseInt(inputProductPrice.value);
            const categoryId = selectProductCategory.value || window._selectedCategoryId || '';
            const desc = inputProductDesc.value.trim();

            if (!name || isNaN(price) || !categoryId) return AppDialog.alert('請完整填寫名稱、價格與選擇分類！', 'warning');

            const storeId = await getStoreId();
            if (!storeId) return;

            const originalText = btnSaveProduct.innerHTML;
            btnSaveProduct.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> 處理中...';
            btnSaveProduct.disabled = true;

            try {
                let finalImageUrl = editingProductId ? productImgPreview.dataset.oldUrl : null;

                if (!currentProductImageFile && productImgPreview.classList.contains('hidden')) {
                    finalImageUrl = null;
                }

                if (currentProductImageFile) {
                    const fileExt = currentProductImageFile.name.split('.').pop();
                    const filePath = `${storeId}/${Date.now()}.${fileExt}`;
                    const { error: uploadError } = await window.supabaseClient.storage.from('product-images').upload(filePath, currentProductImageFile);
                    if (uploadError) throw new Error('圖片上傳失敗：' + uploadError.message);

                    const { data: { publicUrl } } = window.supabaseClient.storage.from('product-images').getPublicUrl(filePath);
                    finalImageUrl = publicUrl;
                }

                const payload = {
                    store_id: storeId,
                    category_id: categoryId,
                    name: name,
                    price: price,
                    description: desc,
                    image_url: finalImageUrl
                };

                let saveError;
                if (editingProductId) {
                    const { error } = await window.supabaseClient.from('products').update(payload).eq('id', editingProductId);
                    saveError = error;
                } else {
                    payload.is_available = true;
                    const { error } = await window.supabaseClient.from('products').insert([payload]);
                    saveError = error;
                }

                if (saveError) throw saveError;

                toggleProductModal(false);
                loadMenu();
                AppDialog.alert('儲存成功！', 'success');

            } catch (err) {
                console.error(err);
                AppDialog.alert('發生錯誤：' + err.message, 'danger');
            } finally {
                btnSaveProduct.innerHTML = originalText;
                btnSaveProduct.disabled = false;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    }

    // =============================================
    // 載入店家資料（Header + 設定頁）
    // =============================================
    let currentStoreData = null;

    async function loadStoreHeader() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const { data: store } = await window.supabaseClient
            .from('stores')
            .select('id, name, phone, address, logo_url, is_open')
            .eq('owner_id', user.id)
            .single();

        if (!store) return;
        currentStoreData = store;

        // 設定頁欄位
        const nameEl = document.getElementById('setting-store-name');
        const phoneEl = document.getElementById('setting-phone');
        const addrEl = document.getElementById('setting-address');
        const emailEl = document.getElementById('setting-email');
        if (nameEl) nameEl.value = store.name || '';
        if (phoneEl) phoneEl.value = store.phone || '';
        if (addrEl) addrEl.value = store.address || '';
        if (emailEl) emailEl.textContent = user.email || '';

        // Logo 預覽
        if (store.logo_url) {
            const prev = document.getElementById('setting-logo-preview');
            const icon = document.getElementById('logo-placeholder-icon');
            if (prev) { prev.src = store.logo_url; prev.classList.remove('hidden'); }
            if (icon) icon.classList.add('hidden');
        }

        // 側邊欄店名
        const sidebarName = document.querySelector('#sidebar .font-bold.text-lg');
        if (sidebarName) sidebarName.textContent = store.name || '我的餐廳';

        // Toggle 狀態
        updateToggleUI(store.is_open !== false);
    }

    function updateToggleUI(isOpen) {
        const btn = document.getElementById('btn-toggle-open');
        const dot = document.getElementById('toggle-dot');
        const label = document.getElementById('toggle-label');
        if (!btn) return;
        btn.classList.remove('hidden');
        if (isOpen) {
            btn.className = 'hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 font-bold text-sm bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100';
            dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
            label.textContent = '營業中';
        } else {
            btn.className = 'hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 font-bold text-sm bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200';
            dot.className = 'w-2 h-2 rounded-full bg-gray-400';
            label.textContent = '休息中';
        }
    }

    // 切換營業狀態
    document.getElementById('btn-toggle-open')?.addEventListener('click', async () => {
        if (!currentStoreData) return;
        const newState = currentStoreData.is_open === false ? true : false;
        currentStoreData.is_open = newState;
        updateToggleUI(newState);
        await window.supabaseClient.from('stores').update({ is_open: newState }).eq('id', currentStoreData.id);
    });

    // 儲存基本資料
    document.getElementById('btn-save-store-info')?.addEventListener('click', async () => {
        if (!currentStoreData) return;
        const btn = document.getElementById('btn-save-store-info');
        const name = document.getElementById('setting-store-name')?.value.trim();
        const phone = document.getElementById('setting-phone')?.value.trim();
        const address = document.getElementById('setting-address')?.value.trim();
        if (!name) { AppDialog.alert('店家名稱不能為空', 'warning'); return; }

        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin inline mr-1"></i> 儲存中...';
        btn.disabled = true;
        lucide.createIcons();

        const { error } = await window.supabaseClient.from('stores').update({ name, phone, address }).eq('id', currentStoreData.id);
        if (error) {
            AppDialog.alert('儲存失敗：' + error.message, 'danger');
            btn.innerHTML = originalHtml; btn.disabled = false; lucide.createIcons();
        } else {
            currentStoreData.name = name;
            const sidebarName = document.querySelector('#sidebar .font-bold.text-lg');
            if (sidebarName) sidebarName.textContent = name;
            btn.innerHTML = '<i data-lucide="check" class="w-4 h-4 inline mr-1"></i> 已儲存！';
            lucide.createIcons();
            checkSetupNotifications();
            setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; lucide.createIcons(); }, 1800);
        }
    });

    // Logo 上傳
    document.getElementById('setting-logo-file')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentStoreData) return;
        const statusEl = document.getElementById('logo-upload-status');
        if (statusEl) statusEl.textContent = '上傳中...';

        const ext = file.name.split('.').pop();
        const path = `${currentStoreData.id}/logo.${ext}`;
        const { error: upErr } = await window.supabaseClient.storage.from('store-logos').upload(path, file, { upsert: true });
        if (upErr) { if (statusEl) statusEl.textContent = '上傳失敗：' + upErr.message; return; }

        const { data: { publicUrl } } = window.supabaseClient.storage.from('store-logos').getPublicUrl(path);
        await window.supabaseClient.from('stores').update({ logo_url: publicUrl }).eq('id', currentStoreData.id);
        currentStoreData.logo_url = publicUrl;

        const prev = document.getElementById('setting-logo-preview');
        const icon = document.getElementById('logo-placeholder-icon');
        if (prev) { prev.src = publicUrl; prev.classList.remove('hidden'); }
        if (icon) icon.classList.add('hidden');
        if (statusEl) statusEl.textContent = '✓ 上傳成功';
        checkSetupNotifications();
    });

    // 登出
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        const ok = await AppDialog.confirm('確定要登出系統嗎？', 'danger', '登出確認');
        if (!ok) return;
        await window.supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });

    // 側邊欄登出按鈕
    document.querySelector('#sidebar .p-4 button')?.addEventListener('click', async () => {
        const ok = await AppDialog.confirm('確定要登出系統嗎？', 'danger', '登出確認');
        if (!ok) return;
        await window.supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });

    // 初始化
    loadStoreHeader();

    // =============================================
    async function checkSetupNotifications() {
        const storeId = await getStoreId();
        if (!storeId) return;

        const { data: { user } } = await window.supabaseClient.auth.getUser();
        const { data: store } = await window.supabaseClient
            .from('stores').select('name, phone, address, logo_url').eq('id', storeId).single();
        const { data: products } = await window.supabaseClient
            .from('products').select('id').eq('store_id', storeId).limit(1);
        const { data: tables } = await window.supabaseClient
            .from('tables').select('id').eq('store_id', storeId).limit(1);

        const items = [];

        if (store) {
            if (!store.phone || !store.address) items.push({
                icon: 'store',
                title: '完善店家基本資料',
                desc: '電話與地址尚未填寫',
                target: 'section-settings',
                targetTitle: '店家設定'
            });
            if (!store.logo_url) items.push({
                icon: 'image',
                title: '上傳品牌 Logo',
                desc: 'Logo 有助提升顧客信任感',
                target: 'section-settings',
                targetTitle: '店家設定'
            });
        }
        if (!products || products.length === 0) items.push({
            icon: 'utensils',
            title: '新增第一道餐點',
            desc: '菜單目前是空的，顧客無法點餐',
            target: 'section-menu',
            targetTitle: '菜單管理'
        });
        if (!tables || tables.length === 0) items.push({
            icon: 'qr-code',
            title: '建立桌號與 QR Code',
            desc: '還沒有任何桌號，顧客無法掃碼',
            target: 'section-tables',
            targetTitle: '桌號管理'
        });

        // 付款方式：若從未造訪過設定頁則提示
        const hasSeenPaymentSettings = localStorage.getItem('seen-payment-settings');
        if (!hasSeenPaymentSettings) items.push({
            icon: 'banknote',
            title: '確認付款方式設定',
            desc: '請至設定頁確認您的收款方式',
            target: 'section-settings',
            targetTitle: '店家設定'
        });

        const bellDot = document.getElementById('bell-dot');
        const notifCount = document.getElementById('notif-count');
        const notifList = document.getElementById('notif-list');
        const notifEmpty = document.getElementById('notif-empty');

        if (items.length > 0) {
            bellDot?.classList.remove('hidden');
            if (notifCount) notifCount.textContent = `${items.length} 項`;
            if (notifList) {
                notifList.innerHTML = items.map(item => `
                    <button class="notif-item w-full text-left px-5 py-4 hover:bg-emerald-50 transition-colors flex items-start gap-3"
                        data-target="${item.target}" data-title="${item.targetTitle}">
                        <div class="w-9 h-9 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="${item.icon}" class="w-4 h-4 text-amber-600"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-gray-800 text-sm">${item.title}</p>
                            <p class="text-xs text-gray-400 mt-0.5">${item.desc}</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 shrink-0 mt-1"></i>
                    </button>`).join('');
                if (typeof lucide !== 'undefined') lucide.createIcons();

                // 點擊通知項目 → 跳到對應頁面
                notifList.querySelectorAll('.notif-item').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const targetId = btn.dataset.target;
                        const targetTitle = btn.dataset.title;
                        document.querySelector(`[data-target="${targetId}"]`)?.click();
                        toggleNotifPanel(false);
                    });
                });
            }
            notifEmpty?.classList.add('hidden');
        } else {
            bellDot?.classList.add('hidden');
            if (notifCount) notifCount.textContent = '';
            if (notifList) notifList.innerHTML = '';
            notifEmpty?.classList.remove('hidden');
        }
    }

    function toggleNotifPanel(force) {
        const panel = document.getElementById('notification-panel');
        if (!panel) return;
        const isHidden = panel.classList.contains('hidden');
        const show = force !== undefined ? force : isHidden;
        panel.classList.toggle('hidden', !show);
    }

    document.getElementById('btn-bell')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotifPanel();
    });
    document.addEventListener('click', () => toggleNotifPanel(false));
    document.getElementById('notification-panel')?.addEventListener('click', e => e.stopPropagation());

    // 初始化時檢查通知
    checkSetupNotifications();

    // =============================================
    // 設定頁載入（目前只有付款，未來可擴充）
    // =============================================
    function loadSettings() {
        // 記錄已造訪過設定頁，讓鈴鐺的付款提示消失
        if (!localStorage.getItem('seen-payment-settings')) {
            localStorage.setItem('seen-payment-settings', '1');
            checkSetupNotifications(); // 重新計算通知數量
        }
    }

    // =============================================
    // 店員連結
    // =============================================
    async function loadStaffLink() {
        const storeId = await getStoreId();
        if (!storeId) return;
        const base = location.origin + location.pathname.replace('dashboard.html', '');
        const link = `${base}staff.html?store_id=${storeId}`;
        const textEl = document.getElementById('staff-link-text');
        const openBtn = document.getElementById('btn-open-staff-link');
        if (textEl) textEl.textContent = link;
        if (openBtn) openBtn.href = link;
        document.getElementById('btn-copy-staff-link')?.addEventListener('click', async () => {
            await navigator.clipboard.writeText(link);
            const btn = document.getElementById('btn-copy-staff-link');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check" class="w-4 h-4 inline mr-1"></i> 已複製！';
            lucide.createIcons();
            setTimeout(() => { btn.innerHTML = orig; lucide.createIcons(); }, 2000);
        });
    }

    // 切換到店員管理頁時載入連結
    if (typeof window._staffLinkLoaded === 'undefined') {
        window._staffLinkLoaded = true;
        loadStaffLink();
    }
});