// js/onboarding.js
(function () {
    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof lucide !== 'undefined') lucide.createIcons();

        const SUPABASE_URL = 'https://xhvlwmcrgwskaforgxqd.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_nluuQ4-miY-nunLCYrvTrA_z577O8Pc';
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // --- 🌟 DOM 抓取區 ---
        const btnNext = document.getElementById('btn-next');
        const btnPrev = document.getElementById('btn-prev');
        const title = document.getElementById('step-title');
        const progressLine = document.getElementById('progress-line');
        const logoArea = document.getElementById('logo-upload-area');
        const fileInput = document.getElementById('logo-file-input');
        const logoPreview = document.getElementById('logo-preview');
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        const btnRemoveLogo = document.getElementById('btn-remove-logo');

        // 步驟 2 元素
        const tableCountInput = document.getElementById('setup-table-count');
        const tablePreviewGrid = document.getElementById('table-preview-grid');
        const btnDownloadZip = document.querySelector('button.text-emerald-600');

        // 🌟【新加入：步驟 3 元素】
        const menuItemsList = document.getElementById('menu-items-list');
        const btnAddItem = document.getElementById('btn-add-item');
        const tempMenuItems = [];

        let currentUser = null;
        let currentStoreId = null;
        let uploadedLogoUrl = '';
        let currentStep = 1;
        const totalSteps = 3;

        // 3. 身分檢查
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) { window.location.href = 'login.html'; return; }
        currentUser = user;

        const { data: storeData } = await supabase.from('stores').select('*').eq('owner_id', currentUser.id).single();
        if (storeData) {
            currentStoreId = storeData.id;
            if (document.getElementById('setup-store-name')) document.getElementById('setup-store-name').value = storeData.name || '';
            if (storeData.logo_url) {
                uploadedLogoUrl = storeData.logo_url;
                if (logoPreview) {
                    logoPreview.src = storeData.logo_url;
                    logoPreview.classList.remove('hidden');
                    uploadPlaceholder.classList.add('hidden');
                    // 🌟 加上這行：如果有舊圖，也要把刪除按鈕變出來
                    if (btnRemoveLogo) btnRemoveLogo.classList.remove('hidden');
                }
            }
        }

        const titles = [
            `歡迎回來，${storeData ? storeData.name : '您的餐廳'}！`,
            "步驟 2：建立桌號與專屬 QR Code",
            "步驟 3：建立您的第一份線上菜單"
        ];

        // --- 🌟【補回：步驟 1 圖片上傳與刪除邏輯】---
        if (logoArea && fileInput) {
            // 點擊區塊觸發選檔
            logoArea.onclick = () => fileInput.click();

            // 當選好檔案時執行上傳
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // 防呆：上傳時鎖定按鈕
                if (btnNext) {
                    btnNext.disabled = true;
                    btnNext.classList.add('opacity-50', 'cursor-not-allowed');
                    btnNext.innerHTML = '<i data-lucide="loader" class="animate-spin w-5 h-5"></i> 上傳中...';
                    lucide.createIcons();
                }

                // 顯示預覽
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (logoPreview) {
                        logoPreview.src = ev.target.result;
                        logoPreview.classList.remove('hidden');
                    }
                    if (uploadPlaceholder) uploadPlaceholder.classList.add('hidden');
                    if (btnRemoveLogo) btnRemoveLogo.classList.remove('hidden'); // 顯示刪除按鈕
                };
                reader.readAsDataURL(file);

                // 上傳到 Supabase Storage
                const fileExt = file.name.split('.').pop();
                const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;

                const { data, error } = await supabase.storage
                    .from('store-logos')
                    .upload(filePath, file);

                if (error) {
                    alert('圖片上傳失敗：' + error.message);
                } else {
                    // 🌟 就在這裡！妳要找的那一行出現了
                    const { data: { publicUrl } } = supabase.storage
                        .from('store-logos')
                        .getPublicUrl(filePath);

                    uploadedLogoUrl = publicUrl;
                    console.log('✅ Logo 上傳成功:', uploadedLogoUrl);
                }

                // 解鎖按鈕
                if (btnNext) {
                    btnNext.disabled = false;
                    btnNext.classList.remove('opacity-50', 'cursor-not-allowed');
                    updateUI();
                }
            };
        }

        // 處理刪除 Logo 的邏輯
        if (btnRemoveLogo) {
            btnRemoveLogo.onclick = (e) => {
                e.stopPropagation(); // 防止點到刪除卻又打開選檔視窗
                uploadedLogoUrl = ''; // 清空暫存網址
                if (logoPreview) {
                    logoPreview.src = '';
                    logoPreview.classList.add('hidden');
                }
                if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');
                btnRemoveLogo.classList.add('hidden'); // 隱藏自己
                if (fileInput) fileInput.value = ''; // 清空檔案選擇器
                console.log('🗑️ Logo 已移除');
            };
        }

        // --- 🌟 步驟 2：動態 QR Code 生成 ---
        function renderTablePreviews() {
            if (!tablePreviewGrid || !tableCountInput) return;
            const count = parseInt(tableCountInput.value) || 0;
            tablePreviewGrid.innerHTML = '';
            const baseUrl = window.location.origin + window.location.pathname.replace('onboarding.html', 'order.html');

            for (let i = 1; i <= count; i++) {
                const tableName = `桌號 ${i}`;
                const orderUrl = `${baseUrl}?store_id=${currentStoreId}&table=${encodeURIComponent(tableName)}`;
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderUrl)}`;

                const card = document.createElement('div');
                card.className = "bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center hover:shadow-lg transition-all group fade-in";
                card.innerHTML = `
                    <div class="w-24 h-24 bg-gray-50 rounded-lg mb-3 flex items-center justify-center border border-gray-100 overflow-hidden">
                        <img src="${qrImageUrl}" alt="${tableName}" class="w-20 h-20 object-contain">
                    </div>
                    <span class="font-bold text-gray-700">${tableName}</span>
                `;
                tablePreviewGrid.appendChild(card);
            }
            lucide.createIcons();
        }

        if (tableCountInput) {
            tableCountInput.oninput = () => {
                if (tableCountInput.value > 100) tableCountInput.value = 100;
                renderTablePreviews();
            };
        }

        // --- 🌟【新加入：步驟 3 畫面渲染函式】 ---
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
                    <button onclick="removeTempItem(${index})" class="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                `;
                menuItemsList.appendChild(div);
            });
            lucide.createIcons();
        }

        // 將刪除功能暴露給 window
        window.removeTempItem = (index) => {
            tempMenuItems.splice(index, 1);
            renderMenuList();
        };

        // 綁定「加入菜品」按鈕
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

        // --- 🌟 批次下載 ZIP 邏輯 ---
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

        // --- 🌟 UI 更新與跳轉 ---
        function updateUI() {
            if (title) title.textContent = titles[currentStep - 1];
            if (btnPrev) btnPrev.classList.toggle('invisible', currentStep === 1);

            if (currentStep === 2) renderTablePreviews();
            if (currentStep === 3) renderMenuList();

            if (btnNext) {
                btnNext.innerHTML = currentStep === totalSteps ? '完成設定進入後台 <i data-lucide="check-circle" class="w-5 h-5"></i>' : '儲存並下一步 <i data-lucide="arrow-right" class="w-5 h-5"></i>';
            }

            if (progressLine) progressLine.style.width = `${((currentStep - 1) / (totalSteps - 1)) * 100}%`;

            // 🌟【修正這裡】：更新圓圈與文字狀態
            for (let i = 1; i <= totalSteps; i++) {
                const dot = document.getElementById(`dot-${i}`);
                const text = document.getElementById(`text-${i}`);
                const content = document.getElementById(`step-content-${i}`);

                if (dot && text) {
                    const isActive = i <= currentStep; // 已經過或正在進行的步驟

                    // 變更圓圈顏色：啟動時綠底白字，未啟動時白底灰邊
                    dot.className = `w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md transition-all duration-300 ${isActive ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
                        }`;

                    // 變更文字顏色
                    text.className = `text-sm font-bold transition-colors ${isActive ? 'text-emerald-600' : 'text-gray-400'
                        }`;
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
                        const { error } = await supabase.from('stores').update({
                            name: document.getElementById('setup-store-name').value,
                            phone: document.getElementById('setup-phone').value,
                            address: document.getElementById('setup-address').value,
                            description: document.getElementById('setup-description').value,
                            logo_url: uploadedLogoUrl
                        }).eq('owner_id', currentUser.id);

                        if (error) throw error; // 報錯就跳到 catch，不會往下走
                    }

                    // --- 步驟 2：儲存桌號 ---
                    if (currentStep === 2) {
                        const count = parseInt(tableCountInput.value) || 0;
                        // 確保有 storeId 才能操作
                        if (!currentStoreId) throw new Error("找不到店家 ID，請重新整理頁面");

                        await supabase.from('tables').delete().eq('store_id', currentStoreId);
                        const tablesToInsert = [];
                        for (let i = 1; i <= count; i++) {
                            tablesToInsert.push({ store_id: currentStoreId, table_name: `桌號 ${i}` });
                        }
                        const { error } = await supabase.from('tables').insert(tablesToInsert);
                        if (error) throw error;
                    }

                    // --- 步驟 3：儲存菜單 (改為可選) ---
                    // --- 🌟 步驟 3：菜單存檔（加強偵錯版） ---
                    if (currentStep === 3) {
                        console.log('📝 準備存檔，目前暫存清單：', tempMenuItems);

                        if (tempMenuItems.length > 0) {
                            // 0. 檢查 ID 是否存在
                            if (!currentStoreId) {
                                console.error('❌ 錯誤：找不到 currentStoreId');
                                alert('系統遺失店家 ID，請重新整理頁面再試一次');
                                return;
                            }

                            try {
                                // 1. 先清空舊有的分類（會連帶刪除產品）
                                console.log('🔥 正在清理舊資料...');
                                await supabase.from('categories').delete().eq('store_id', currentStoreId);

                                // 2. 提取不重複分類
                                const uniqueCats = [...new Set(tempMenuItems.map(item => item.category))];
                                console.log('📂 準備建立分類：', uniqueCats);

                                // 3. 建立分類並【務必】使用 .select() 取回 ID
                                const { data: createdCats, error: catErr } = await supabase
                                    .from('categories')
                                    .insert(uniqueCats.map(c => ({
                                        store_id: currentStoreId,
                                        name: c
                                    })))
                                    .select(); // 👈 沒這行，後面就拿不到 ID

                                if (catErr) throw catErr;
                                console.log('✅ 分類建立成功：', createdCats);

                                // 4. 產品對應分類 ID
                                const productsToInsert = tempMenuItems.map(item => {
                                    // 在剛建立成功的分類中找到對應的那一個
                                    const catObj = createdCats.find(c => c.name === item.category);
                                    return {
                                        store_id: currentStoreId,
                                        category_id: catObj ? catObj.id : null,
                                        name: item.name,
                                        price: item.price
                                    };
                                }).filter(p => p.category_id !== null); // 過濾掉沒對到分類的（防呆）

                                console.log('📦 準備存入產品：', productsToInsert);

                                // 5. 存入產品
                                const { error: prodErr } = await supabase
                                    .from('products')
                                    .insert(productsToInsert);

                                if (prodErr) throw prodErr;
                                console.log('🎉 所有產品存檔成功！');

                            } catch (error) {
                                console.error('❌ 存檔過程出錯：', error);
                                alert('存檔失敗：' + error.message);
                                return; // 報錯就停止，不跳轉
                            }
                        }

                        // 6. 最後標記初始化完成並跳轉
                        console.log('🏁 標記初始化完成...');
                        await supabase.from('stores')
                            .update({ is_initialized: true })
                            .eq('owner_id', currentUser.id);

                        window.location.href = 'dashboard.html';
                    }

                    // 🌟 關鍵位子：這裡必須在所有 if (currentStep) 之外
                    // 確保前面的存檔完成後，步驟一定會 +1 並更新 UI
                    if (currentStep < totalSteps) {
                        currentStep++;
                        updateUI();
                        console.log('🚀 前進到步驟：', currentStep);
                    }

                } catch (err) {
                    console.error('❌ 按鈕執行失敗:', err);
                    alert('發生錯誤：' + (err.message || '請檢查網路連線'));
                }
            };
        }

        if (btnPrev) {
            btnPrev.onclick = () => { if (currentStep > 1) { currentStep--; updateUI(); } };
        }

        updateUI();
    });
})();