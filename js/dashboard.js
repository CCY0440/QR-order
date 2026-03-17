// =============================================
// dashboard.js — 完整升級版 (含自訂分類選單與圖片裁切)
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // ==========================================
    // 全域客製化對話框系統 (AppDialog)
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

                modal.classList.remove('hidden');
                setTimeout(() => {
                    modal.classList.remove('opacity-0');
                    content.classList.remove('scale-95', 'opacity-0');
                }, 10);

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
    // 側邊欄與 SPA 切換邏輯
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
            // 🌟 修正：全部加上 typeof 檢查，避免找不到函數時報錯當機
            if (targetId === 'section-menu' && typeof loadMenu === 'function') loadMenu();
            if (targetId === 'section-overview' && typeof window.loadOverview === 'function') window.loadOverview();
            if (targetId === 'section-tables' && typeof window.loadTables === 'function') window.loadTables();
            if (targetId === 'section-settings' && typeof loadSettings === 'function') loadSettings();
            if (targetId === 'section-orders' && typeof window.loadOrders === 'function') window.loadOrders();
            if (targetId === 'section-reports' && typeof window.loadReports === 'function') window.loadReports();
            if (targetId === 'section-employees' && typeof window.loadStaff === 'function') window.loadStaff();
            if (targetId === 'section-history' && typeof window.initHistory === 'function') window.initHistory();

            // 手機版點擊後自動收起側邊欄
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
    // 載入與渲染大菜單
    // ==========================================
    async function loadMenu() {
        const container = document.getElementById('menu-list-container');
        if (!container) return;

        try {
            const storeId = await getStoreId();
            if (!storeId) return;

            const { data: cats } = await window.supabaseClient.from('categories').select('id, name').eq('store_id', storeId);
            const catMap = {};
            (cats || []).forEach(c => { catMap[c.id] = c.name; });

            const { data: products, error } = await window.supabaseClient
                .from('products')
                .select('id, category_id, name, price, description, image_url, is_available')
                .eq('store_id', storeId)
                .order('name');
            if (error) throw error;

            allProducts = (products || []).map(p => ({
                ...p,
                categories: { name: catMap[p.category_id] || '未分類' }
            }));

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
                    const statusHtml = p.is_available
                        ? `<span class="inline-flex items-center justify-center w-14 py-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-md border border-emerald-200 cursor-pointer hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors btn-toggle-available" data-id="${p.id}" data-available="true">供應中</span>`
                        : `<span class="inline-flex items-center justify-center w-14 py-1 bg-red-50 text-red-500 text-[11px] font-bold rounded-md border border-red-200 cursor-pointer hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors btn-toggle-available" data-id="${p.id}" data-available="false">已停售</span>`;

                    html += `<tr class="hover:bg-gray-50/50 transition-colors group"><td class="p-3 pl-5 font-bold text-gray-800">${p.name}</td><td class="p-3 font-mono text-gray-600">NT$ ${p.price}</td><td class="p-3">${statusHtml}</td><td class="p-3 text-right pr-5 opacity-0 group-hover:opacity-100 transition-opacity"><button onclick="editProduct('${p.id}')" class="text-gray-400 hover:text-emerald-600 p-1.5 rounded transition-colors" title="編輯"><i data-lucide="edit-3" class="w-4 h-4"></i></button><button onclick="deleteProduct('${p.id}', '${p.name}', '${p.image_url || ''}')" class="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors" title="刪除"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`;
                });
                html += `</tbody></table></div></div>`;
            }
            html += '</div>';
            container.innerHTML = html;
            lucide.createIcons();

            container.querySelectorAll('.btn-toggle-available').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    const next = btn.dataset.available !== 'true';
                    btn.dataset.available = String(next);
                    if (next) {
                        btn.className = "inline-flex items-center justify-center w-14 py-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-md border border-emerald-200 cursor-pointer hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors btn-toggle-available";
                        btn.textContent = '供應中';
                    } else {
                        btn.className = "inline-flex items-center justify-center w-14 py-1 bg-red-50 text-red-500 text-[11px] font-bold rounded-md border border-red-200 cursor-pointer hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors btn-toggle-available";
                        btn.textContent = '已停售';
                    }
                    await window.supabaseClient.from('products').update({ is_available: next }).eq('id', id);
                    allProducts = allProducts.map(p => p.id === id ? { ...p, is_available: next } : p);
                });
            });

        } catch (err) {
            container.innerHTML = '<p class="text-center text-red-500 py-10 font-bold">載入失敗，請檢查網路連線。</p>';
        }
    }

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

        const { data: categories, error } = await window.supabaseClient.from('categories').select('*').eq('store_id', storeId).order('name');

        if (error || categories.length === 0) {
            categoryListContainer.innerHTML = '<p class="text-center text-gray-400 text-sm py-4 border-2 border-dashed border-gray-100 rounded-xl">目前沒有任何分類</p>';
            return;
        }

        let html = '';
        categories.forEach(cat => {
            html += `
            <div class="flex items-center justify-between bg-white border border-gray-100 p-3 pl-4 rounded-xl shadow-sm hover:border-emerald-200 transition-colors group">
                <span class="font-bold text-gray-700 flex-1 truncate" id="cat-name-${cat.id}">${cat.name}</span>
                
                <input type="text" id="cat-input-${cat.id}" class="hidden flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-800" value="${cat.name}">
                
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3 shrink-0" id="cat-actions-${cat.id}">
                    <button onclick="editCategory('${cat.id}')" class="text-gray-400 hover:text-emerald-600 p-1.5 rounded-lg transition-colors bg-white shadow-sm border border-gray-100 hover:border-emerald-200" title="編輯分類名稱">
                        <i data-lucide="edit-3" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                    <button onclick="deleteCategory('${cat.id}', '${cat.name}')" class="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-colors bg-white shadow-sm border border-gray-100 hover:border-red-200" title="刪除分類">
                        <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                </div>
                
                <div class="hidden items-center gap-1 ml-3 shrink-0" id="cat-save-actions-${cat.id}">
                    <button onclick="cancelEditCategory('${cat.id}')" class="text-gray-400 hover:bg-gray-100 p-1.5 rounded-lg transition-colors" title="取消">
                        <i data-lucide="x" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                    <button onclick="saveCategory('${cat.id}')" class="text-emerald-500 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors border border-emerald-200" title="儲存">
                        <i data-lucide="check" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                </div>
            </div>`;
        });
        categoryListContainer.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // 🌟 開啟編輯模式
    window.editCategory = function (id) {
        document.getElementById(`cat-name-${id}`).classList.add('hidden');
        document.getElementById(`cat-actions-${id}`).classList.add('hidden');

        const input = document.getElementById(`cat-input-${id}`);
        input.classList.remove('hidden');
        document.getElementById(`cat-save-actions-${id}`).classList.remove('hidden');
        document.getElementById(`cat-save-actions-${id}`).classList.add('flex');

        input.focus(); // 自動將游標移進去

        // 支援按 Enter 直接儲存
        input.onkeypress = function (e) {
            if (e.key === 'Enter') saveCategory(id);
        };
    };

    // 🌟 取消編輯模式
    window.cancelEditCategory = function (id) {
        const input = document.getElementById(`cat-input-${id}`);
        const nameSpan = document.getElementById(`cat-name-${id}`);

        input.value = nameSpan.textContent; // 恢復原有名稱

        input.classList.add('hidden');
        document.getElementById(`cat-save-actions-${id}`).classList.add('hidden');
        document.getElementById(`cat-save-actions-${id}`).classList.remove('flex');

        nameSpan.classList.remove('hidden');
        document.getElementById(`cat-actions-${id}`).classList.remove('hidden');
    };

    // 🌟 儲存修改後的分類名稱
    window.saveCategory = async function (id) {
        const newName = document.getElementById(`cat-input-${id}`).value.trim();

        if (!newName) {
            AppDialog.alert('分類名稱不能為空！', 'warning');
            return;
        }

        // 把按鈕變成 Loading 狀態
        const saveActions = document.getElementById(`cat-save-actions-${id}`);
        saveActions.innerHTML = '<i data-lucide="loader" class="w-5 h-5 text-emerald-500 animate-spin mx-2"></i>';
        lucide.createIcons();

        try {
            const { error } = await window.supabaseClient
                .from('categories')
                .update({ name: newName })
                .eq('id', id);

            if (error) throw error;

            // 重新載入分類清單
            loadCategories();

        } catch (err) {
            AppDialog.alert('更新失敗：' + err.message, 'danger');
            cancelEditCategory(id);
        }
    };

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
    // 🌟 新增/編輯餐點 Modal (全自訂分類下拉選單 + 裁切)
    // ==========================================
    const modalProduct = document.getElementById('modal-product');
    const modalProductContent = document.getElementById('modal-product-content');
    const btnCreateProduct = document.getElementById('btn-create-product');
    const btnCloseProductModal = document.getElementById('btn-close-product-modal');
    const btnCancelProduct = document.getElementById('btn-cancel-product');
    const btnSaveProduct = document.getElementById('btn-save-product');

    const inputProductName = document.getElementById('input-product-name');
    const inputProductPrice = document.getElementById('input-product-price');
    const inputProductDesc = document.getElementById('input-product-desc');

    const productUploadArea = document.getElementById('product-image-area');
    const productFileInput = document.getElementById('input-product-image');
    const productImgPreview = document.getElementById('product-image-preview');
    const productUploadPlaceholder = document.getElementById('product-image-placeholder');
    const btnRemoveProductImage = document.getElementById('btn-remove-product-image');

    let currentProductImageFile = null;
    let currentSelectedCategoryId = ''; // 用來儲存當前選擇的分類ID

    // 🌟 自訂分類選單邏輯
    const categoryWrapper = document.getElementById('custom-category-wrapper');
    const categoryBtn = document.getElementById('btn-custom-category');
    const categoryText = document.getElementById('text-custom-category');
    const categoryList = document.getElementById('list-custom-category');
    const categoryIcon = document.getElementById('icon-custom-category');

    if (categoryBtn) {
        categoryBtn.onclick = (e) => {
            e.stopPropagation();
            const isHidden = categoryList.classList.contains('hidden');
            if (isHidden) {
                categoryList.classList.remove('hidden');
                setTimeout(() => {
                    categoryList.classList.remove('opacity-0', '-translate-y-2');
                    categoryIcon.classList.add('rotate-180');
                }, 10);
            } else {
                closeCustomCategory();
            }
        };
    }

    function closeCustomCategory() {
        if (!categoryList) return;
        categoryList.classList.add('opacity-0', '-translate-y-2');
        categoryIcon.classList.remove('rotate-180');
        setTimeout(() => categoryList.classList.add('hidden'), 200);
    }

    document.addEventListener('click', (e) => {
        if (categoryWrapper && !categoryWrapper.contains(e.target)) {
            closeCustomCategory();
        }
    });

    async function populateCategorySelect() {
        const storeId = await getStoreId();
        if (!storeId) return;
        const { data: categories } = await window.supabaseClient.from('categories').select('id, name').eq('store_id', storeId);

        if (categories && categories.length > 0) {
            categoryList.innerHTML = categories.map(c => `
                <div class="px-5 py-3 text-sm font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer border-b border-gray-50 last:border-0" data-value="${c.id}" data-name="${c.name}">
                    ${c.name}
                </div>
            `).join('');

            categoryList.querySelectorAll('div').forEach(opt => {
                opt.onclick = (e) => {
                    e.stopPropagation();
                    currentSelectedCategoryId = opt.getAttribute('data-value');
                    categoryText.textContent = opt.getAttribute('data-name');
                    categoryText.classList.remove('text-gray-400');
                    categoryText.classList.add('text-gray-800');
                    closeCustomCategory();
                };
            });
        } else {
            categoryList.innerHTML = '<div class="p-4 text-sm font-bold text-gray-400 text-center">請先建立分類</div>';
        }
    }

    // 清空表單
    function resetProductForm() {
        editingProductId = null;
        inputProductName.value = '';
        inputProductPrice.value = '';
        inputProductDesc.value = '';

        currentSelectedCategoryId = '';
        if (categoryText) {
            categoryText.textContent = '請選擇分類...';
            categoryText.classList.replace('text-gray-800', 'text-gray-400');
        }

        if (typeof window.clearProductOptions === 'function') window.clearProductOptions();

        currentProductImageFile = null;
        if (productImgPreview) {
            productImgPreview.src = '';
            productImgPreview.dataset.oldUrl = '';
            productImgPreview.classList.add('hidden');
        }
        if (productUploadPlaceholder) productUploadPlaceholder.classList.remove('hidden');
        if (btnRemoveProductImage) btnRemoveProductImage.classList.add('hidden');
        if (productFileInput) productFileInput.value = '';

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

    window.editProduct = async (id) => {
        const product = allProducts.find(p => p.id === id);
        if (!product) return;
        editingProductId = product.id;

        inputProductName.value = product.name;
        inputProductPrice.value = product.price;
        inputProductDesc.value = product.description || '';

        await populateCategorySelect();

        currentSelectedCategoryId = product.category_id;
        const catName = product.categories ? product.categories.name : '未知分類';
        if (categoryText) {
            categoryText.textContent = catName;
            categoryText.classList.replace('text-gray-400', 'text-gray-800');
        }

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

        if (typeof window.loadProductOptions === 'function') {
            const { data: opts } = await window.supabaseClient
                .from('product_options').select('*').eq('product_id', id).order('sort_order');
            window.loadProductOptions(opts || []);
        }

        modalProduct.classList.remove('hidden');
        setTimeout(() => {
            modalProduct.classList.remove('opacity-0');
            modalProductContent.classList.remove('scale-95', 'opacity-0');
        }, 10);
    };

    // 🌟 圖片上傳與裁切邏輯
    let cropper = null;
    const modalCrop = document.getElementById('modal-crop');
    const modalCropContent = document.getElementById('modal-crop-content');
    const imageToCrop = document.getElementById('image-to-crop');

    if (productUploadArea && productFileInput) {
        productUploadArea.onclick = (e) => {
            if (e.target.closest('#btn-remove-product-image')) return;
            if (e.target.tagName.toLowerCase() === 'input') return;
            productFileInput.click();
        };

        productFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                AppDialog.alert('請上傳有效的圖片檔案 (JPG / PNG)！', 'warning');
                productFileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                imageToCrop.src = ev.target.result;
                openCropModal();
            };
            reader.readAsDataURL(file);
            productFileInput.value = '';
        };
    }

    function openCropModal() {
        modalCrop.classList.remove('hidden');
        setTimeout(() => {
            modalCrop.classList.remove('opacity-0');
            modalCropContent.classList.remove('scale-95', 'opacity-0');
        }, 10);

        if (cropper) cropper.destroy();
        cropper = new Cropper(imageToCrop, {
            aspectRatio: 1,
            viewMode: 2,
            dragMode: 'move',
            autoCropArea: 0.9,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function closeCropModal() {
        modalCrop.classList.add('opacity-0');
        modalCropContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modalCrop.classList.add('hidden');
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            imageToCrop.src = '';
        }, 300);
    }

    document.getElementById('btn-close-crop')?.addEventListener('click', closeCropModal);
    document.getElementById('btn-cancel-crop')?.addEventListener('click', closeCropModal);

    document.getElementById('btn-confirm-crop')?.addEventListener('click', () => {
        if (!cropper) return;

        const btnConfirmCrop = document.getElementById('btn-confirm-crop');
        const originalHtml = btnConfirmCrop.innerHTML;
        btnConfirmCrop.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> 處理中...';
        btnConfirmCrop.disabled = true;

        const canvas = cropper.getCroppedCanvas({
            width: 800,
            height: 800,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        canvas.toBlob((blob) => {
            if (!blob) {
                AppDialog.alert('裁切失敗，請重試', 'danger');
                btnConfirmCrop.innerHTML = originalHtml;
                btnConfirmCrop.disabled = false;
                return;
            }

            currentProductImageFile = new File([blob], `cropped_${Date.now()}.jpg`, { type: 'image/jpeg' });

            const previewUrl = URL.createObjectURL(blob);
            productImgPreview.src = previewUrl;
            productImgPreview.classList.remove('hidden');
            productUploadPlaceholder.classList.add('hidden');
            btnRemoveProductImage.classList.remove('hidden');

            btnConfirmCrop.innerHTML = originalHtml;
            btnConfirmCrop.disabled = false;
            closeCropModal();
        }, 'image/jpeg', 0.85);
    });

    if (btnRemoveProductImage) {
        btnRemoveProductImage.onclick = (e) => {
            e.stopPropagation();
            currentProductImageFile = null;
            productImgPreview.src = '';
            productImgPreview.dataset.oldUrl = '';
            productImgPreview.classList.add('hidden');
            productUploadPlaceholder.classList.remove('hidden');
            btnRemoveProductImage.classList.add('hidden');
            productFileInput.value = '';
        };
    }

    if (btnSaveProduct) {
        btnSaveProduct.addEventListener('click', async () => {
            const name = inputProductName.value.trim();
            const price = parseInt(inputProductPrice.value);
            const categoryId = currentSelectedCategoryId; // 🌟 取得自訂分類的值
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
                let savedProductId = editingProductId;
                if (editingProductId) {
                    const { error } = await window.supabaseClient.from('products').update(payload).eq('id', editingProductId);
                    saveError = error;
                } else {
                    payload.is_available = true;
                    const { data: inserted, error } = await window.supabaseClient.from('products').insert([payload]).select().single();
                    saveError = error;
                    if (inserted) savedProductId = inserted.id;
                }

                if (saveError) throw saveError;

                if (savedProductId && typeof window.saveProductOptions === 'function') {
                    await window.saveProductOptions(savedProductId, storeId);
                }

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

        const nameEl = document.getElementById('setting-store-name');
        const phoneEl = document.getElementById('setting-phone');
        const addrEl = document.getElementById('setting-address');
        const emailEl = document.getElementById('setting-email');
        if (nameEl) nameEl.value = store.name || '';
        if (phoneEl) phoneEl.value = store.phone || '';
        if (addrEl) addrEl.value = store.address || '';
        if (emailEl) emailEl.textContent = user.email || '';
        const descEl = document.getElementById('setting-description');
        if (descEl) descEl.value = store.description || '';

        if (store.logo_url) {
            const prev = document.getElementById('setting-logo-preview');
            const icon = document.getElementById('logo-placeholder-icon');
            if (prev) { prev.src = store.logo_url; prev.classList.remove('hidden'); }
            if (icon) icon.classList.add('hidden');
        }

        const sidebarName = document.querySelector('#sidebar .font-bold.text-lg');
        if (sidebarName) sidebarName.textContent = store.name || '我的餐廳';

        const sidebarEmail = document.getElementById('sidebar-user-email');
        if (sidebarEmail) sidebarEmail.textContent = user.email || '';

        updateToggleUI(store.is_open !== false);
    }

    function updateToggleUI(isOpen) {
        const btn = document.getElementById('btn-toggle-open');
        const dot = document.getElementById('toggle-dot');
        const label = document.getElementById('toggle-label');
        if (!btn) return;
        if (isOpen) {
            btn.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-200 font-bold text-xs sm:text-sm bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100';
            dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0';
            if (label) label.textContent = '營業中';
        } else {
            btn.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-200 font-bold text-xs sm:text-sm bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200';
            dot.className = 'w-2 h-2 rounded-full bg-gray-400 shrink-0';
            if (label) label.textContent = '休息中';
        }
    }

    document.getElementById('btn-toggle-open')?.addEventListener('click', async () => {
        if (!currentStoreData) return;
        const newState = currentStoreData.is_open === false ? true : false;
        currentStoreData.is_open = newState;
        updateToggleUI(newState);
        await window.supabaseClient.from('stores').update({ is_open: newState }).eq('id', currentStoreData.id);
    });

    document.getElementById('btn-save-store-info')?.addEventListener('click', async () => {
        if (!currentStoreData) return;
        const btn = document.getElementById('btn-save-store-info');
        const name = document.getElementById('setting-store-name')?.value.trim();
        const phone = document.getElementById('setting-phone')?.value.trim();
        const address = document.getElementById('setting-address')?.value.trim();
        const description = document.getElementById('setting-description')?.value.trim();
        if (!name) { AppDialog.alert('店家名稱不能為空', 'warning'); return; }

        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin inline mr-1"></i> 儲存中...';
        btn.disabled = true;
        lucide.createIcons();

        const { error } = await window.supabaseClient.from('stores').update({ name, phone, address, description }).eq('id', currentStoreData.id);
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

    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        const ok = await AppDialog.confirm('確定要登出系統嗎？', 'danger', '登出確認');
        if (!ok) return;
        await window.supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });

    document.querySelector('#sidebar .p-4 button')?.addEventListener('click', async () => {
        const ok = await AppDialog.confirm('確定要登出系統嗎？', 'danger', '登出確認');
        if (!ok) return;
        await window.supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });

    loadStoreHeader();

    async function checkSetupNotifications() {
        const storeId = await getStoreId();
        if (!storeId) return;

        const { data: store } = await window.supabaseClient.from('stores').select('name, phone, address, logo_url').eq('id', storeId).single();
        const { data: products } = await window.supabaseClient.from('products').select('id').eq('store_id', storeId).limit(1);
        const { data: tables } = await window.supabaseClient.from('tables').select('id').eq('store_id', storeId).limit(1);

        const items = [];

        if (store) {
            if (!store.phone || !store.address) items.push({ icon: 'store', title: '完善店家基本資料', desc: '電話與地址尚未填寫', target: 'section-settings' });
            if (!store.logo_url) items.push({ icon: 'image', title: '上傳品牌 Logo', desc: 'Logo 有助提升顧客信任感', target: 'section-settings' });
        }
        if (!products || products.length === 0) items.push({ icon: 'utensils', title: '新增第一道餐點', desc: '菜單目前是空的，顧客無法點餐', target: 'section-menu' });
        if (!tables || tables.length === 0) items.push({ icon: 'qr-code', title: '建立桌號與 QR Code', desc: '還沒有任何桌號，顧客無法掃碼', target: 'section-tables' });
        if (!localStorage.getItem('seen-payment-settings')) items.push({ icon: 'banknote', title: '確認付款方式', desc: '請至設定頁確認您的收款方式', target: 'section-settings' });

        const notifList = document.getElementById('page-notif-list');
        const notifEmpty = document.getElementById('page-notif-empty');
        const sidebarBadge = document.getElementById('sidebar-notif-badge');

        if (items.length > 0) {
            if (sidebarBadge) { sidebarBadge.textContent = items.length; sidebarBadge.classList.remove('hidden'); }
            if (notifEmpty) notifEmpty.classList.add('hidden');
            if (notifList) {
                notifList.innerHTML = items.map(item => `
                    <div class="px-6 py-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                        <div class="w-10 h-10 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center shrink-0"><i data-lucide="${item.icon}" class="w-5 h-5 text-amber-600"></i></div>
                        <div class="flex-1 min-w-0 pt-0.5">
                            <p class="font-bold text-sm text-gray-800">${item.title}</p>
                            <p class="text-xs mt-1 text-gray-500">${item.desc}</p>
                        </div>
                        <button onclick="document.querySelector('[data-target=\\'${item.target}\\']').click()" class="shrink-0 px-3 py-1.5 bg-white border border-gray-200 hover:border-emerald-400 hover:text-emerald-600 rounded-lg text-xs font-bold text-gray-600 transition-colors mt-1">前往設定</button>
                    </div>`).join('');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        } else {
            if (sidebarBadge) sidebarBadge.classList.add('hidden');
            if (notifList) notifList.innerHTML = '';
            if (notifEmpty) notifEmpty.classList.remove('hidden');
        }
    }

    document.getElementById('btn-bell')?.addEventListener('click', (e) => {
        e.preventDefault();
        const bell = document.getElementById('btn-bell');
        const dot = document.getElementById('bell-dot');
        if (bell) bell.classList.remove('animate-ring', 'text-emerald-500');
        if (dot) dot.classList.add('hidden');
        window._pendingBellNotifs = [];
    });

    checkSetupNotifications();

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
            btn.innerHTML = '<i data-lucide=\"check\" class=\"w-4 h-4 inline mr-1\"></i> 已複製！';
            lucide.createIcons();
            setTimeout(() => { btn.innerHTML = orig; lucide.createIcons(); }, 2000);
        });
    }

    if (typeof window._staffLinkLoaded === 'undefined') {
        window._staffLinkLoaded = true;
        loadStaffLink();
    }

    const modalContact = document.getElementById('modal-contact');
    const modalContactContent = document.getElementById('modal-contact-content');
    const btnOpenContact = document.getElementById('btn-open-contact');
    const btnCloseContact = document.getElementById('btn-close-contact');
    const btnCancelContact = document.getElementById('btn-cancel-contact');
    const btnSendContact = document.getElementById('btn-send-contact');

    function toggleContactModal(show) {
        if (show) {
            modalContact.classList.remove('hidden');
            setTimeout(() => {
                modalContact.classList.remove('opacity-0');
                modalContactContent.classList.remove('scale-95', 'opacity-0');
            }, 10);
            const emailInput = document.getElementById('contact-email');
            const userEmail = document.getElementById('sidebar-user-email')?.textContent;
            if (userEmail && userEmail !== '載入中...') {
                emailInput.value = userEmail;
            }
        } else {
            modalContact.classList.add('opacity-0');
            modalContactContent.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modalContact.classList.add('hidden');
                document.getElementById('contact-message').value = '';
            }, 300);
        }
    }

    if (btnOpenContact) btnOpenContact.addEventListener('click', () => toggleContactModal(true));
    if (btnCloseContact) btnCloseContact.addEventListener('click', () => toggleContactModal(false));
    if (btnCancelContact) btnCancelContact.addEventListener('click', () => toggleContactModal(false));

    if (btnSendContact) {
        btnSendContact.addEventListener('click', async () => {
            const email = document.getElementById('contact-email').value.trim();
            const message = document.getElementById('contact-message').value.trim();
            if (!email || !message) return window.AppDialog.alert('請填寫聯絡信箱與問題描述！', 'warning');

            const originalHtml = btnSendContact.innerHTML;
            btnSendContact.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> 傳送中...';
            btnSendContact.disabled = true;
            lucide.createIcons();

            try {
                const response = await fetch('https://formspree.io/f/xlgpllpq', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, message: message, subject: '【系統回報】來自 QR 點餐店家的訊息' })
                });
                if (!response.ok) throw new Error('發送失敗');
                await new Promise(resolve => setTimeout(resolve, 1500));
                window.AppDialog.alert('您的訊息已成功送出！我們會盡快回覆至您的信箱。', 'success');
                toggleContactModal(false);
            } catch (err) {
                window.AppDialog.alert('發送失敗，請稍後再試或直接來信。', 'danger');
            } finally {
                btnSendContact.innerHTML = originalHtml;
                btnSendContact.disabled = false;
                lucide.createIcons();
            }
        });
    }
});