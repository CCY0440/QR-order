// js/tables.js
// 桌號與 QR Code 管理模組
// 需在 dashboard.html 載入 QRCode.js、JSZip、FileSaver

(async function initTablesModule() {

    // =============================================
    // 工具：取得當前店家 ID（複用 dashboard.js 的 getStoreId）
    // =============================================
    async function getStoreId() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return null;
        const { data: store } = await window.supabaseClient
            .from('stores').select('id').eq('owner_id', user.id).single();
        return store ? store.id : null;
    }

    let currentStoreId = null;

    // =============================================
    // 組出點餐頁網址
    // =============================================
    function getOrderUrl(storeId, tableName) {
        // 自動偵測目前的部署路徑（相容本機與線上）
        const base = window.location.href.split('?')[0].replace(/\/[^\/]*$/, '');
        return `${base}/order.html?store_id=${storeId}&table=${encodeURIComponent(tableName)}`;
    }

    // =============================================
    // 主要載入函式（由 dashboard.js 呼叫）
    // =============================================
    window.loadTables = async function () {
        const grid = document.getElementById('tables-grid');
        const countBadge = document.getElementById('tables-count');
        if (!grid) return;

        grid.innerHTML = `
            <div class="col-span-full flex justify-center py-20">
                <i data-lucide="loader" class="w-8 h-8 text-emerald-500 animate-spin"></i>
            </div>`;
        lucide.createIcons();

        currentStoreId = await getStoreId();
        if (!currentStoreId) {
            grid.innerHTML = '<p class="col-span-full text-center text-red-500 py-20 font-bold">無法取得店家資訊，請重新整理。</p>';
            return;
        }

        const { data: tables, error } = await window.supabaseClient
            .from('tables')
            .select('*')
            .eq('store_id', currentStoreId)
            .order('created_at', { ascending: true });

        if (error) {
            grid.innerHTML = '<p class="col-span-full text-center text-red-500 py-20 font-bold">載入失敗，請重新整理。</p>';
            return;
        }

        if (countBadge) countBadge.textContent = tables ? tables.length : 0;

        // 同步頂部輸入框的數字
        const countInput = document.getElementById('input-table-count');
        if (countInput && tables) countInput.value = tables.length;

        if (!tables || tables.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-24 text-gray-400 fade-in">
                    <div class="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-5">
                        <i data-lucide="qr-code" class="w-10 h-10 text-gray-300"></i>
                    </div>
                    <p class="font-bold text-gray-500 mb-1 text-lg">尚未建立任何桌號</p>
                    <p class="text-sm text-gray-400 mb-6">點擊右上角「新增桌號」開始設定</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        renderCards(tables);
    };

    // =============================================
    // 渲染 QR Code 卡片
    // =============================================
    function renderCards(tables) {
        const grid = document.getElementById('tables-grid');
        grid.innerHTML = '';

        tables.forEach(table => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-3 hover:shadow-md hover:border-emerald-200 transition-all duration-200 group fade-in';
            card.dataset.tableId = table.id;

            const qrUrl = getOrderUrl(currentStoreId, table.table_name);

            card.innerHTML = `
                <div class="flex justify-between items-center w-full">
                    <span class="font-black text-gray-800 truncate text-sm">${table.table_name}</span>
                    <button class="btn-delete-table p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        data-id="${table.id}" data-name="${table.table_name}" title="刪除桌號">
                        <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                </div>

                <!-- QR Code 容器 -->
                <div class="relative w-36 h-36">
                    <div id="qr-${table.id}" class="w-36 h-36 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-gray-100 p-1"></div>
                    <div class="absolute inset-0 rounded-xl border-2 border-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </div>

                <!-- 操作按鈕 -->
                <div class="flex gap-1.5 w-full">
                    <button class="btn-preview-qr text-xs font-bold py-2.5 px-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 flex items-center justify-center gap-1 whitespace-nowrap"
                        data-url="${qrUrl}" title="預覽點餐頁">
                        <i data-lucide="eye" class="w-3.5 h-3.5 pointer-events-none shrink-0"></i>
                        <span class="pointer-events-none">預覽</span>
                    </button>
                    <button class="btn-download-qr flex-1 text-xs font-bold py-2.5 px-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100 flex items-center justify-center gap-1.5"
                        data-id="${table.id}" data-name="${table.table_name}">
                        <i data-lucide="download" class="w-3.5 h-3.5 pointer-events-none"></i> 下載
                    </button>
                </div>`;

            grid.appendChild(card);

            // 生成 QR Code（使用 canvas 模式，方便下載）
            setTimeout(() => {
                const qrEl = document.getElementById(`qr-${table.id}`);
                if (qrEl && typeof QRCode !== 'undefined') {
                    new QRCode(qrEl, {
                        text: qrUrl,
                        width: 128,
                        height: 128,
                        colorDark: '#111827',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.M
                    });
                }
            }, 50);
        });

        lucide.createIcons();

        // 綁定：預覽點餐頁
        grid.querySelectorAll('.btn-preview-qr').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (url) window.open(url, '_blank');
            });
        });

        // 綁定：刪除桌號
        grid.querySelectorAll('.btn-delete-table').forEach(btn => {
            btn.addEventListener('click', async () => {
                const confirmed = await window.AppDialog.confirm(
                    `確定要刪除「${btn.dataset.name}」嗎？刪除後無法恢復。`, 'danger', '刪除桌號');
                if (!confirmed) return;

                const { error } = await window.supabaseClient.from('tables').delete().eq('id', btn.dataset.id);
                if (error) { window.AppDialog.alert('刪除失敗：' + error.message, 'danger'); return; }

                const card = btn.closest('[data-table-id]');
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    card.remove();
                    const remaining = grid.querySelectorAll('[data-table-id]').length;
                    const countBadge = document.getElementById('tables-count');
                    if (countBadge) countBadge.textContent = remaining;
                    if (remaining === 0) window.loadTables(); // 重新渲染空狀態
                }, 300);
            });
        });

        // 綁定：下載單張 QR Code
        grid.querySelectorAll('.btn-download-qr').forEach(btn => {
            btn.addEventListener('click', () => {
                const qrEl = document.getElementById(`qr-${btn.dataset.id}`);
                if (!qrEl) return;
                const canvas = qrEl.querySelector('canvas');
                if (!canvas) { window.AppDialog.alert('QR Code 尚未生成，請稍等片刻再試。', 'warning'); return; }

                // 加上白色邊框再下載
                const finalCanvas = document.createElement('canvas');
                const pad = 20;
                finalCanvas.width = canvas.width + pad * 2;
                finalCanvas.height = canvas.height + pad * 2 + 36;
                const ctx = finalCanvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
                ctx.drawImage(canvas, pad, pad);
                ctx.fillStyle = '#111827';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(btn.dataset.name, finalCanvas.width / 2, canvas.height + pad + 22);

                const link = document.createElement('a');
                link.download = `QRCode_${btn.dataset.name}.png`;
                link.href = finalCanvas.toDataURL('image/png');
                link.click();
            });
        });
    }

    // =============================================
    // 批次下載所有 QR Code 為 ZIP
    // =============================================
    document.getElementById('btn-download-all-qr')?.addEventListener('click', async () => {
        if (typeof JSZip === 'undefined') {
            window.AppDialog.alert('JSZip 尚未載入，請重新整理後再試。', 'warning');
            return;
        }

        const cards = document.querySelectorAll('#tables-grid [data-table-id]');
        if (cards.length === 0) {
            window.AppDialog.alert('目前沒有桌號可以下載。', 'warning');
            return;
        }

        const btn = document.getElementById('btn-download-all-qr');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin inline mr-1"></i> 打包中...';
        btn.disabled = true;
        lucide.createIcons();

        const zip = new JSZip();

        for (const card of cards) {
            const tableId = card.dataset.tableId;
            const tableName = card.querySelector('.font-black')?.textContent?.trim();
            const qrEl = document.getElementById(`qr-${tableId}`);
            const canvas = qrEl?.querySelector('canvas');
            if (!canvas || !tableName) continue;

            // 加上邊框和桌號文字
            const finalCanvas = document.createElement('canvas');
            const pad = 20;
            finalCanvas.width = canvas.width + pad * 2;
            finalCanvas.height = canvas.height + pad * 2 + 36;
            const ctx = finalCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            ctx.drawImage(canvas, pad, pad);
            ctx.fillStyle = '#111827';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(tableName, finalCanvas.width / 2, canvas.height + pad + 22);

            const dataUrl = finalCanvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];
            zip.file(`QRCode_${tableName}.png`, base64, { base64: true });
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, 'QRCodes_所有桌號.zip');

        btn.innerHTML = originalHtml;
        btn.disabled = false;
        lucide.createIcons();
    });

    // =============================================
    // 桌數輸入框：即時更新畫面，背景靜默同步 DB
    // =============================================
    const countInput = document.getElementById('input-table-count');
    let dbSyncTimer = null;

    countInput?.addEventListener('input', () => {
        const target = parseInt(countInput.value);
        if (isNaN(target) || target < 1 || target > 100) return;

        // 1. 立刻更新畫面（不等 DB）
        renderCount(target);

        // 2. 停止輸入 1 秒後，靜默同步 DB
        clearTimeout(dbSyncTimer);
        dbSyncTimer = setTimeout(() => syncDB(target), 1000);
    });

    // 純前端渲染：直接增減卡片，不重新載入
    function renderCount(target) {
        const grid = document.getElementById('tables-grid');
        const cards = [...grid.querySelectorAll('[data-table-id]')];
        const current = cards.length;

        if (target > current) {
            // 新增卡片（用假 id 佔位，DB sync 後會 reload 補上真實 id）
            for (let i = current + 1; i <= target; i++) {
                const tableName = `桌號${i}`;
                const qrUrl = getOrderUrl(currentStoreId, tableName);
                const card = document.createElement('div');
                card.className = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-3 hover:shadow-md hover:border-emerald-200 transition-all duration-200 group fade-in';
                card.dataset.tableId = `temp-${i}`;
                card.innerHTML = `
                    <div class="flex justify-between items-center w-full">
                        <span class="font-black text-gray-800 truncate text-sm">${tableName}</span>
                        <button class="btn-delete-table p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            data-id="temp-${i}" data-name="${tableName}" title="刪除桌號">
                            <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                        </button>
                    </div>
                    <div class="relative w-36 h-36">
                        <div id="qr-temp-${i}" class="w-36 h-36 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-gray-100 p-1"></div>
                        <div class="absolute inset-0 rounded-xl border-2 border-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </div>
                    <div class="flex gap-1.5 w-full">
                        <button class="btn-preview-qr text-xs font-bold py-2.5 px-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 flex items-center justify-center gap-1 whitespace-nowrap"
                            data-url="${qrUrl}" title="預覽點餐頁">
                            <i data-lucide="eye" class="w-3.5 h-3.5 pointer-events-none shrink-0"></i>
                            <span class="pointer-events-none">預覽</span>
                        </button>
                        <button class="btn-download-qr flex-1 text-xs font-bold py-2.5 px-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100 flex items-center justify-center gap-1.5"
                            data-id="temp-${i}" data-name="${tableName}">
                            <i data-lucide="download" class="w-3.5 h-3.5 pointer-events-none"></i> 下載
                        </button>
                    </div>`;
                grid.appendChild(card);

                setTimeout(() => {
                    const qrEl = document.getElementById(`qr-temp-${i}`);
                    if (qrEl && typeof QRCode !== 'undefined') {
                        new QRCode(qrEl, { text: qrUrl, width: 128, height: 128, colorDark: '#111827', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
                    }
                }, 50);
            }
            lucide.createIcons();

        } else if (target < current) {
            // 移除多餘的卡片（從後面刪）
            cards.slice(target).forEach(card => {
                card.style.transition = 'opacity 0.2s, transform 0.2s';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => card.remove(), 200);
            });
        }

        // 更新 badge
        const countBadge = document.getElementById('tables-count');
        if (countBadge) countBadge.textContent = target;
    }

    // 背景靜默同步 DB（使用者感覺不到）
    async function syncDB(target) {
        const { data: existing } = await window.supabaseClient
            .from('tables').select('id, table_name').eq('store_id', currentStoreId)
            .order('created_at', { ascending: true });

        const current = existing ? existing.length : 0;
        if (target === current) return;

        if (target > current) {
            const rows = Array.from({ length: target - current }, (_, i) => ({
                store_id: currentStoreId,
                table_name: `桌號${current + i + 1}`
            }));
            await window.supabaseClient.from('tables').insert(rows);
        } else {
            const toDelete = existing.slice(target).map(t => t.id);
            await window.supabaseClient.from('tables').delete().in('id', toDelete);
        }

        // 靜默 reload 補上真實 id（用戶通常已停止操作）
        await window.loadTables();
    }

})();