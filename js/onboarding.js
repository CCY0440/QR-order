// js/onboarding.js
(function () {
    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // 🌟 初始化已經移除，直接使用 supabaseClient
        const btnNext = document.getElementById('btn-next');
        const btnPrev = document.getElementById('btn-prev');
        const title = document.getElementById('step-title');
        const progressLine = document.getElementById('progress-line');
        const logoArea = document.getElementById('logo-upload-area');
        const fileInput = document.getElementById('logo-file-input');
        const logoPreview = document.getElementById('logo-preview');
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        const btnRemoveLogo = document.getElementById('btn-remove-logo');

        const tableCountInput = document.getElementById('setup-table-count');
        const tablePreviewGrid = document.getElementById('table-preview-grid');
        const btnDownloadZip = document.getElementById('btn-download-zip');

        function getTableNames() {
            const count = Math.min(parseInt(tableCountInput?.value) || 0, 100);
            return Array.from({ length: count }, (_, i) => `桌號${i + 1}`);
        }

        function renderTablePreviews() {
            if (!tablePreviewGrid) return;
            const names = getTableNames();
            tablePreviewGrid.innerHTML = '';
            const baseUrl = window.location.origin + window.location.pathname.replace('onboarding.html', 'order.html');

            names.forEach(tableName => {
                const orderUrl = `${baseUrl}?store_id=${currentStoreId}&table=${encodeURIComponent(tableName)}`;
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderUrl)}`;
                const card = document.createElement('div');
                card.className = "bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center hover:shadow-lg transition-all fade-in";
                card.innerHTML = `
                    <div class="w-24 h-24 bg-gray-50 rounded-lg mb-3 flex items-center justify-center border border-gray-100 overflow-hidden">
                        <img src="${qrImageUrl}" alt="${tableName}" class="w-20 h-20 object-contain">
                    </div>
                    <span class="font-bold text-gray-700 text-sm">${tableName}</span>`;
                tablePreviewGrid.appendChild(card);
            });
            lucide.createIcons();
        }

        if (tableCountInput) {
            tableCountInput.oninput = () => {
                if (parseInt(tableCountInput.value) > 100) tableCountInput.value = 100;
                renderTablePreviews();
            };
        }

        const menuItemsList = document.getElementById('menu-items-list');
        const btnAddItem = document.getElementById('btn-add-item');
        const tempMenuItems = [];

        let currentUser = null;
        let currentStoreId = null;
        let uploadedLogoUrl = '';
        let currentStep = 1;
        const totalSteps = 3;

        // 🌟 小工具 1：全形轉半形 (地址與文字通用)
        function toHalfWidth(str) {
            if (!str) return '';
            // 會自動把 ０-９、Ａ-Ｚ、以及 （） 等全形符號轉成半形
            return str.replace(/[\uff01-\uff5e]/g, function (char) {
                return String.fromCharCode(char.charCodeAt(0) - 65248);
            }).replace(/\u3000/g, ' ');
        }

        // 🌟 小工具 2：台灣電話智慧格式化 (支援所有例外區碼)
        function formatTaiwanPhone(phone) {
            let p = toHalfWidth(phone).trim();
            let digits = p.replace(/\D/g, '');

            if (digits.startsWith('09') && digits.length === 10) {
                return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
            }
            else if (digits.startsWith('0') && digits.length >= 9) {
                // 特殊區碼清單
                const fourDigitAreas = ['0826', '0836']; // 烏坵、馬祖
                const threeDigitAreas = ['037', '049', '082', '089']; // 苗栗、南投、金門、台東

                let area = '';
                let local = '';

                // 優先比對 4 碼與 3 碼區碼
                if (fourDigitAreas.some(a => digits.startsWith(a))) {
                    area = digits.slice(0, 4);
                    local = digits.slice(4);
                } else if (threeDigitAreas.some(a => digits.startsWith(a))) {
                    area = digits.slice(0, 3);
                    local = digits.slice(3);
                } else {
                    area = digits.slice(0, 2);
                    local = digits.slice(2);
                }

                // 根據市話長度決定橫槓位置 (6碼為 xxx-xxx，7或8碼為 xxx-xxxx)
                if (local.length === 6) {
                    return `(${area}) ${local.slice(0, 3)}-${local.slice(3)}`;
                } else {
                    return `(${area}) ${local.slice(0, local.length - 4)}-${local.slice(-4)}`;
                }
            }
            return p;
        }

        // 3. 身分檢查
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (!user || authError) { window.location.href = 'login.html'; return; }
        currentUser = user;

        const { data: storeData } = await supabaseClient.from('stores').select('*').eq('owner_id', currentUser.id).single();
        if (storeData) {
            currentStoreId = storeData.id;
            if (document.getElementById('setup-store-name')) document.getElementById('setup-store-name').value = storeData.name || '';
            if (storeData.logo_url) {
                uploadedLogoUrl = storeData.logo_url;
                if (logoPreview) {
                    logoPreview.src = storeData.logo_url;
                    logoPreview.classList.remove('hidden');
                    uploadPlaceholder.classList.add('hidden');
                    if (btnRemoveLogo) btnRemoveLogo.classList.remove('hidden');
                }
            }
        }

        const titles = [
            `歡迎回來，${storeData ? storeData.name : '您的餐廳'}！`,
            "步驟 2：建立桌號與專屬 QR Code",
            "步驟 3：建立您的第一份線上菜單"
        ];

        if (logoArea && fileInput) {
            logoArea.onclick = () => fileInput.click();
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (btnNext) {
                    btnNext.disabled = true;
                    btnNext.classList.add('opacity-50', 'cursor-not-allowed');
                    btnNext.innerHTML = '<i data-lucide="loader" class="animate-spin w-5 h-5"></i> 上傳中...';
                    lucide.createIcons();
                }

                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (logoPreview) {
                        logoPreview.src = ev.target.result;
                        logoPreview.classList.remove('hidden');
                    }
                    if (uploadPlaceholder) uploadPlaceholder.classList.add('hidden');
                    if (btnRemoveLogo) btnRemoveLogo.classList.remove('hidden');
                };
                reader.readAsDataURL(file);

                const fileExt = file.name.split('.').pop();
                const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;

                const { data, error } = await supabaseClient.storage.from('store-logos').upload(filePath, file);

                if (error) {
                    alert('圖片上傳失敗：' + error.message);
                } else {
                    const { data: { publicUrl } } = supabaseClient.storage.from('store-logos').getPublicUrl(filePath);
                    uploadedLogoUrl = publicUrl;
                }

                if (btnNext) {
                    btnNext.disabled = false;
                    btnNext.classList.remove('opacity-50', 'cursor-not-allowed');
                    updateUI();
                }
            };
        }

        // 處理刪除 Logo 的邏輯 (進階版：連同 Storage 一起刪除)
        if (btnRemoveLogo) {
            btnRemoveLogo.onclick = async (e) => {
                e.stopPropagation(); // 防止點到刪除卻又打開選檔視窗

                // 1. 讓按鈕顯示轉圈圈，防止使用者連點
                const originalIcon = btnRemoveLogo.innerHTML;
                btnRemoveLogo.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i>';
                lucide.createIcons();

                // 2. 去 Supabase Storage 把實體檔案徹底刪除
                if (uploadedLogoUrl) {
                    try {
                        // 🌟 這裡最重要！必須先把 filePath 從網址中「切」出來，電腦才知道要刪誰
                        const filePath = uploadedLogoUrl.split('/store-logos/')[1];

                        if (filePath) {
                            const { data, error } = await supabaseClient.storage.from('store-logos').remove([filePath]);

                            if (error) {
                                console.error('Storage 刪除失敗:', error);
                            } else if (data && data.length === 0) {
                                // 🌟 如果沒有 error，但刪除名單是空的，代表被權限擋下來了
                                console.warn('⚠️ 檔案未刪除，可能是 Supabase Storage RLS 權限不足！');
                            } else {
                                console.log('🗑️ Storage 實體檔案已徹底清除:', filePath);
                            }
                        }
                    } catch (err) {
                        console.error('刪除過程發生意外:', err);
                    }
                }

                // 3. 恢復原本的 UI 狀態與變數
                uploadedLogoUrl = ''; // 清空暫存網址
                if (logoPreview) {
                    logoPreview.src = '';
                    logoPreview.classList.add('hidden');
                }
                if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');
                btnRemoveLogo.classList.add('hidden');
                btnRemoveLogo.innerHTML = originalIcon; // 恢復叉叉圖示
                if (fileInput) fileInput.value = ''; // 清空檔案選擇器
            };
        }

        function renderTablePreviews() {
            if (!tablePreviewGrid || !tableCountInput) return;
            const names = getTableNames();
            tablePreviewGrid.innerHTML = '';
            const baseUrl = window.location.origin + window.location.pathname.replace('onboarding.html', 'order.html');

            names.forEach(tableName => {
                const orderUrl = `${baseUrl}?store_id=${currentStoreId}&table=${encodeURIComponent(tableName)}`;
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderUrl)}`;

                const card = document.createElement('div');
                card.className = "bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center hover:shadow-lg transition-all fade-in";
                card.innerHTML = `
                    <div class="w-24 h-24 bg-gray-50 rounded-lg mb-3 flex items-center justify-center border border-gray-100 overflow-hidden">
                        <img src="${qrImageUrl}" alt="${tableName}" class="w-20 h-20 object-contain">
                    </div>
                    <span class="font-bold text-gray-700 text-sm">${tableName}</span>
                `;
                tablePreviewGrid.appendChild(card);
            });
            lucide.createIcons();
        }

        function renderMenuList() {
            if (!menuItemsList) return;
            if (tempMenuItems.length === 0) {
                menuItemsList.innerHTML = '<p class="text-center text-gray-400 py-10 border-2 border-dashed border-gray-100 rounded-2xl">目前還沒有新增任何菜品</p>';
                return;
            }
            menuItemsList.innerHTML = '';
            tempMenuItems.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = "flex items-center gap-6 p-4 border border-gray-200 rounded-2xl bg-white fade-in shadow-sm";
                div.innerHTML = `
                    <div class="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 font-bold shrink-0">${index + 1}</div>
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-800">${item.name}</h4>
                        <p class="text-sm text-gray-500">${item.category} / NT$ ${item.price}</p>
                    </div>
                    <button onclick="removeTempItem(${index})" class="p-2 text-gray-400 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                `;
                menuItemsList.appendChild(div);
            });
            lucide.createIcons();
        }

        window.removeTempItem = (index) => { tempMenuItems.splice(index, 1); renderMenuList(); };

        if (btnAddItem) {
            btnAddItem.onclick = () => {
                const name = document.getElementById('menu-item-name').value;
                const category = document.getElementById('menu-item-category').value;
                const price = document.getElementById('menu-item-price').value;
                if (!name || !category || !price) return alert('請完整填寫菜品資訊');
                tempMenuItems.push({ name, category, price: parseInt(price) });
                document.getElementById('menu-item-name').value = '';
                document.getElementById('menu-item-category').value = '';
                document.getElementById('menu-item-price').value = '';
                renderMenuList();
            };
        }

        if (btnDownloadZip) {
            btnDownloadZip.onclick = async () => {
                const qrImages = tablePreviewGrid.querySelectorAll('img');
                if (qrImages.length === 0) return alert('請先輸入桌數！');
                const zip = new JSZip();
                const imgFolder = zip.folder("餐廳QR碼");
                const originalText = btnDownloadZip.innerHTML;
                btnDownloadZip.innerHTML = '<i data-lucide="loader" class="animate-spin w-4 h-4"></i> 打包中...';
                lucide.createIcons();
                try {
                    const promises = Array.from(qrImages).map(async (img, index) => {
                        const response = await fetch(img.src);
                        const blob = await response.blob();
                        imgFolder.file(`桌號_${index + 1}.png`, blob);
                    });
                    await Promise.all(promises);
                    const content = await zip.generateAsync({ type: "blob" });
                    saveAs(content, "餐廳桌號QR碼.zip");
                } catch (err) { alert('下載失敗'); }
                finally { btnDownloadZip.innerHTML = originalText; lucide.createIcons(); }
            };
        }

        function updateUI() {
            if (title) title.textContent = titles[currentStep - 1];
            if (btnPrev) btnPrev.classList.toggle('invisible', currentStep === 1);
            if (currentStep === 2) renderTablePreviews();
            if (currentStep === 3) renderMenuList();
            if (btnNext) btnNext.innerHTML = currentStep === totalSteps ? '完成設定進入後台 <i data-lucide="check-circle" class="w-5 h-5"></i>' : '儲存並下一步 <i data-lucide="arrow-right" class="w-5 h-5"></i>';
            if (progressLine) progressLine.style.width = `${((currentStep - 1) / (totalSteps - 1)) * 100}%`;

            for (let i = 1; i <= totalSteps; i++) {
                const dot = document.getElementById(`dot-${i}`);
                const text = document.getElementById(`text-${i}`);
                const content = document.getElementById(`step-content-${i}`);
                if (dot && text) {
                    const isActive = i <= currentStep;
                    dot.className = `w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md transition-all duration-300 ${isActive ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'}`;
                    text.className = `text-sm font-bold transition-colors ${isActive ? 'text-emerald-600' : 'text-gray-400'}`;
                }
                if (content) content.classList.toggle('hidden', i !== currentStep);
            }
            lucide.createIcons();
        }

        if (btnNext) {
            btnNext.onclick = async () => {
                try {
                    // --- 步驟 1：儲存店家基本資訊 ---
                    if (currentStep === 1) {
                        // 1. 抓取原始輸入值
                        const rawPhone = document.getElementById('setup-phone').value;
                        const rawAddress = document.getElementById('setup-address').value;

                        // 2. 存入資料庫 (過濾與清洗)
                        const { error } = await supabaseClient.from('stores').update({
                            name: document.getElementById('setup-store-name').value,
                            phone: formatTaiwanPhone(rawPhone),        // 🌟 智慧格式化：加橫槓與括號
                            address: toHalfWidth(rawAddress),          // 🌟 地址全形轉半形
                            description: document.getElementById('setup-description').value,
                            logo_url: uploadedLogoUrl
                        }).eq('owner_id', currentUser.id);

                        if (error) throw error;
                    }

                    if (currentStep === 2) {
                        const names = getTableNames();
                        if (names.length === 0) throw new Error('請輸入桌數');
                        if (!currentStoreId) throw new Error('找不到店家 ID，請重新整理頁面');
                        await supabaseClient.from('tables').delete().eq('store_id', currentStoreId);
                        const tablesToInsert = names.map(name => ({ store_id: currentStoreId, table_name: name }));
                        const { error } = await supabaseClient.from('tables').insert(tablesToInsert);
                        if (error) throw error;
                    }

                    if (currentStep === 3) {
                        if (tempMenuItems.length > 0) {
                            if (!currentStoreId) throw new Error("找不到店家 ID");
                            await supabaseClient.from('categories').delete().eq('store_id', currentStoreId);
                            const uniqueCats = [...new Set(tempMenuItems.map(item => item.category))];
                            const { data: createdCats, error: catErr } = await supabaseClient
                                .from('categories')
                                .insert(uniqueCats.map(c => ({ store_id: currentStoreId, name: c })))
                                .select();
                            if (catErr) throw catErr;

                            const productsToInsert = tempMenuItems.map(item => {
                                const catObj = createdCats.find(c => c.name === item.category);
                                return {
                                    store_id: currentStoreId,
                                    category_id: catObj ? catObj.id : null,
                                    name: item.name,
                                    price: item.price
                                };
                            }).filter(p => p.category_id !== null);

                            const { error: prodErr } = await supabaseClient.from('products').insert(productsToInsert);
                            if (prodErr) throw prodErr;
                        }

                        await supabaseClient.from('stores').update({ is_initialized: true }).eq('owner_id', currentUser.id);
                        window.location.href = 'dashboard.html';
                        return;
                    }

                    if (currentStep < totalSteps) {
                        currentStep++;
                        updateUI();
                    }

                } catch (err) {
                    alert('發生錯誤：' + (err.message || '請檢查網路連線'));
                }
            };
        }

        if (btnPrev) btnPrev.onclick = () => { if (currentStep > 1) { currentStep--; updateUI(); } };
        updateUI();
    });
})();