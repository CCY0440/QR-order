// =============================================
// product-options.js — 客製化選項編輯器
// =============================================
(function () {
    let editingOptions = []; // 當前編輯中的選項列表

    const TYPE_LABELS = {
        single: '單選',
        multi: '多選',
        text: '備註文字',
    };

    // 供 dashboard.js 呼叫：載入既有選項
    window.loadProductOptions = function (productOptions) {
        editingOptions = (productOptions || [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(o => ({
                id: o.id,            // 已存在的 UUID（新建為 null）
                label: o.label,
                type: o.type,
                choices: o.choices || [],
                required: o.required || false,
            }));
        renderOptionsEditor();
    };

    // 供 dashboard.js 呼叫：取得目前編輯的選項
    window.getEditingOptions = function () { return editingOptions; };

    // 清空
    window.clearProductOptions = function () { editingOptions = []; renderOptionsEditor(); };

    function renderOptionsEditor() {
        const container = document.getElementById('options-editor');
        if (!container) return;

        if (editingOptions.length === 0) {
            container.innerHTML = `<p class="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-xl">尚未設定客製化欄位</p>`;
            return;
        }

        container.innerHTML = editingOptions.map((opt, i) => {
            const needChoices = opt.type === 'single' || opt.type === 'multi';
            return `
            <div class="border border-gray-200 rounded-xl overflow-hidden" data-opt-idx="${i}">
                <div class="bg-gray-50 px-3 py-2.5 flex flex-wrap items-center gap-2 border-b border-gray-100">
                    <span class="w-5 h-5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shrink-0">${i + 1}</span>
                    <input type="text" class="opt-label-input min-w-0 flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        placeholder="欄位名稱，例如：辣度、加料" value="${opt.label}" data-idx="${i}">
                    <div class="flex items-center gap-2 shrink-0">
                        <select class="opt-type-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" data-idx="${i}">
                            ${Object.entries(TYPE_LABELS).map(([val, lbl]) =>
                `<option value="${val}" ${opt.type === val ? 'selected' : ''}>${lbl}</option>`
            ).join('')}
                        </select>
                        <button class="btn-remove-opt w-7 h-7 bg-white border border-gray-200 hover:border-red-300 hover:text-red-500 text-gray-400 rounded-lg flex items-center justify-center transition-colors shrink-0" data-idx="${i}">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
                        </button>
                    </div>
                </div>
                <div class="px-3 py-3 space-y-3 bg-white">
                    <label class="flex items-center gap-2 cursor-pointer w-fit">
                        <input type="checkbox" class="opt-required-check w-4 h-4 accent-emerald-500" data-idx="${i}" ${opt.required ? 'checked' : ''}>
                        <span class="text-xs font-bold text-gray-500">此欄位為必填</span>
                    </label>
                    ${opt.type === 'text' ? `
                    <p class="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        顧客點餐時將看到一個文字輸入框，可以自由填寫備註
                    </p>` : ''}
                    ${needChoices ? `
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <p class="text-xs font-bold text-gray-500">選項設定</p>
                            <p class="text-[10px] text-gray-400">${opt.type === 'multi' ? '顧客可複選' : '顧客單選一項'}</p>
                        </div>
                        <div class="opt-choices-list space-y-1.5" data-idx="${i}">
                            ${(opt.choices || []).map((c, ci) => renderChoiceRow(i, ci, c)).join('')}
                        </div>
                        <button class="btn-add-choice text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 py-1" data-idx="${i}">
                            <i data-lucide="plus" class="w-3 h-3"></i> 新增選項
                        </button>
                    </div>` : ''}
                </div>
            </div>`;
        }).join('');

        lucide.createIcons();
        bindEditorEvents();
    }

    function renderChoiceRow(optIdx, choiceIdx, choice) {
        return `
        <div class="flex items-center gap-1.5 choice-row" data-opt-idx="${optIdx}" data-choice-idx="${choiceIdx}">
            <input type="text" class="choice-label min-w-0 flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="例：小辣" value="${choice.label || ''}">
            <div class="flex items-center gap-1 shrink-0">
                <span class="text-[10px] text-gray-400 font-bold whitespace-nowrap">+NT$</span>
                <input type="number" class="choice-price w-16 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                    placeholder="0" min="0" value="${choice.price || 0}">
            </div>
            <button class="btn-remove-choice w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 shrink-0" data-opt-idx="${optIdx}" data-choice-idx="${choiceIdx}">
                <i data-lucide="x" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
        </div>`;
    }

    function bindEditorEvents() {
        const container = document.getElementById('options-editor');
        if (!container) return;

        container.querySelectorAll('.opt-label-input').forEach(el => {
            el.addEventListener('input', () => { editingOptions[el.dataset.idx].label = el.value; });
        });
        container.querySelectorAll('.opt-type-select').forEach(el => {
            el.addEventListener('change', () => {
                editingOptions[el.dataset.idx].type = el.value;
                if (el.value === 'text') editingOptions[el.dataset.idx].choices = [];
                renderOptionsEditor();
            });
        });
        container.querySelectorAll('.opt-required-check').forEach(el => {
            el.addEventListener('change', () => { editingOptions[el.dataset.idx].required = el.checked; });
        });
        container.querySelectorAll('.btn-remove-opt').forEach(el => {
            el.addEventListener('click', () => {
                editingOptions.splice(parseInt(el.dataset.idx), 1);
                renderOptionsEditor();
            });
        });
        container.querySelectorAll('.btn-add-choice').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                if (!editingOptions[idx].choices) editingOptions[idx].choices = [];
                editingOptions[idx].choices.push({ label: '', price: 0 });
                renderOptionsEditor();
            });
        });
        container.querySelectorAll('.btn-remove-choice').forEach(el => {
            el.addEventListener('click', () => {
                const oi = parseInt(el.dataset.optIdx), ci = parseInt(el.dataset.choiceIdx);
                editingOptions[oi].choices.splice(ci, 1);
                renderOptionsEditor();
            });
        });
        // Sync choice inputs on blur
        container.querySelectorAll('.choice-row').forEach(row => {
            const oi = parseInt(row.dataset.optIdx), ci = parseInt(row.dataset.choiceIdx);
            row.querySelector('.choice-label')?.addEventListener('input', e => {
                if (editingOptions[oi]?.choices[ci]) editingOptions[oi].choices[ci].label = e.target.value;
            });
            row.querySelector('.choice-price')?.addEventListener('input', e => {
                if (editingOptions[oi]?.choices[ci]) editingOptions[oi].choices[ci].price = parseInt(e.target.value) || 0;
            });
        });
        lucide.createIcons();
    }

    // 新增欄位按鈕
    document.getElementById('btn-add-option')?.addEventListener('click', () => {
        editingOptions.push({ id: null, label: '', type: 'single', choices: [{ label: '', price: 0 }], required: false });
        renderOptionsEditor();
    });

    // 供 dashboard.js 呼叫：儲存到 DB
    window.saveProductOptions = async function (productId, storeId) {
        // 先刪除已存在的（只刪舊的 id）
        const existingIds = editingOptions.filter(o => o.id).map(o => o.id);
        const { data: dbOpts } = await window.supabaseClient
            .from('product_options').select('id').eq('product_id', productId);
        const toDelete = (dbOpts || []).filter(o => !existingIds.includes(o.id)).map(o => o.id);
        if (toDelete.length > 0) {
            await window.supabaseClient.from('product_options').delete().in('id', toDelete);
        }

        // Upsert 所有選項
        for (let i = 0; i < editingOptions.length; i++) {
            const opt = editingOptions[i];
            if (!opt.label.trim()) continue;
            const payload = {
                product_id: productId,
                store_id: storeId,
                label: opt.label.trim(),
                type: opt.type,
                choices: (opt.type === 'single' || opt.type === 'multi') ? opt.choices : null,
                required: opt.required,
                sort_order: i,
            };
            if (opt.id) {
                await window.supabaseClient.from('product_options').update(payload).eq('id', opt.id);
            } else {
                await window.supabaseClient.from('product_options').insert(payload);
            }
        }
    };
})();