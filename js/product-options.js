// =============================================
// product-options.js — 客製化選項編輯器 (高質感全自訂下拉版)
// =============================================
(function () {
    let editingOptions = [];

    // 類型對應標籤
    const TYPE_LABELS = {
        'radio': '單選 (只能挑一項)',
        'multi': '多選 (可挑多項)',
        'text': '文字備註'
    };

    window.loadProductOptions = function (options) {
        editingOptions = JSON.parse(JSON.stringify(options || []));
        // 如果載入的選項沒有 choices，預設給一個空的
        editingOptions.forEach(opt => {
            if (!opt.choices && opt.type !== 'text') opt.choices = [{ label: '', price: 0 }];
        });
        renderOptionsEditor();
    };

    window.clearProductOptions = function () {
        editingOptions = [];
        renderOptionsEditor();
    };

    function renderOptionsEditor() {
        const container = document.getElementById('options-editor');
        if (!container) return;

        if (editingOptions.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-gray-400"><i data-lucide="sliders-horizontal" class="w-8 h-8 mx-auto mb-2 opacity-50"></i><p class="text-sm font-bold">尚未設定客製化選項</p><p class="text-xs mt-1">點擊右上方「新增欄位」開始設定</p></div>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        container.innerHTML = editingOptions.map((opt, i) => {
            const isText = opt.type === 'text';

            // 處理細項 (Choices)
            let choicesHtml = '';
            if (!isText) {
                const choices = opt.choices || [];
                choicesHtml = `
                <div class="mt-3 space-y-2 pl-3 border-l-2 border-gray-100">
                    ${choices.map((c, ci) => `
                    <div class="flex items-center gap-2 group/choice">
                        <div class="flex-1 min-w-0">
                            <input type="text" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-gray-800 placeholder-gray-400 choice-label" placeholder="選項名稱 (例：大辣)" value="${c.label || ''}" data-opt-idx="${i}" data-choice-idx="${ci}">
                        </div>
                        <div class="flex items-center gap-1 shrink-0 bg-gray-50 border border-gray-200 rounded-lg px-2">
                            <span class="text-xs font-bold text-gray-400">+NT$</span>
                            <input type="number" class="w-14 bg-transparent py-1.5 text-sm font-bold text-gray-800 outline-none text-right choice-price" placeholder="0" min="0" value="${c.price || 0}" data-opt-idx="${i}" data-choice-idx="${ci}">
                        </div>
                        <button type="button" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 opacity-0 group-hover/choice:opacity-100 btn-remove-choice" data-opt-idx="${i}" data-choice-idx="${ci}" title="刪除選項">
                            <i data-lucide="minus-circle" class="w-4 h-4 pointer-events-none"></i>
                        </button>
                    </div>
                    `).join('')}
                    <button type="button" class="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 mt-2 btn-add-choice" data-idx="${i}">
                        <i data-lucide="plus" class="w-3 h-3 pointer-events-none"></i> 新增選項
                    </button>
                </div>`;
            }

            // 🌟 核心：全自訂的高質感下拉選單 HTML 結構
            const customDropdownHtml = `
            <div class="relative custom-opt-type-wrapper shrink-0" data-idx="${i}">
                <button type="button" class="opt-type-btn flex items-center justify-between w-36 bg-gray-50 hover:bg-white border border-gray-200 text-gray-700 rounded-xl px-3 py-2 text-xs font-bold transition-all shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                    <span class="truncate">${TYPE_LABELS[opt.type] || '請選擇'}</span>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform dropdown-icon"></i>
                </button>
                <div class="opt-type-list absolute z-[60] w-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden hidden opacity-0 transition-all duration-200 transform -translate-y-2">
                    ${Object.entries(TYPE_LABELS).map(([val, lbl]) => `
                        <div class="px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer border-b border-gray-50 last:border-0 opt-type-option" data-value="${val}">
                            ${lbl}
                        </div>
                    `).join('')}
                </div>
            </div>`;

            return `
            <div class="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm relative group mb-4">
                
                <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                    <div class="flex-1 flex items-center gap-2 min-w-0">
                        <div class="w-1.5 h-5 bg-emerald-400 rounded-full shrink-0"></div>
                        <input type="text" class="w-full bg-transparent text-sm sm:text-base font-black text-gray-800 placeholder-gray-300 outline-none focus:border-b-2 focus:border-emerald-400 transition-all min-w-0 truncate opt-label-input" placeholder="輸入欄位名稱 (例如：甜度、加料)" value="${opt.label || ''}" data-idx="${i}">
                    </div>
                    
                    <div class="flex items-center gap-2 shrink-0">
                        ${customDropdownHtml}
                        
                        <label class="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors shadow-sm">
                            <input type="checkbox" class="w-3.5 h-3.5 text-emerald-500 rounded focus:ring-emerald-500 opt-required-checkbox" data-idx="${i}" ${opt.required ? 'checked' : ''}>
                            <span class="text-xs font-bold text-gray-600">必填</span>
                        </label>
                        
                        <button type="button" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0 border border-transparent hover:border-red-100 btn-remove-opt" data-idx="${i}" title="刪除欄位">
                            <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                        </button>
                    </div>
                </div>
                ${choicesHtml}
            </div>`;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
        bindEvents();
    }

    function bindEvents() {
        const container = document.getElementById('options-editor');
        if (!container) return;

        // 🌟 1. 綁定「全自訂下拉選單」的開啟與切換事件
        container.querySelectorAll('.custom-opt-type-wrapper').forEach(wrapper => {
            const btn = wrapper.querySelector('.opt-type-btn');
            const list = wrapper.querySelector('.opt-type-list');
            const icon = wrapper.querySelector('.dropdown-icon');
            const idx = parseInt(wrapper.dataset.idx);

            // 點擊按鈕開啟/關閉
            btn.onclick = (e) => {
                e.stopPropagation();
                // 先關閉其他所有打開的選單 (確保畫面上只有一個選單展開)
                document.querySelectorAll('.opt-type-list').forEach(l => {
                    if (l !== list) {
                        l.classList.add('opacity-0', '-translate-y-2');
                        setTimeout(() => l.classList.add('hidden'), 200);
                        const otherIcon = l.parentElement.querySelector('.dropdown-icon');
                        if (otherIcon) otherIcon.classList.remove('rotate-180');
                    }
                });

                const isHidden = list.classList.contains('hidden');
                if (isHidden) {
                    list.classList.remove('hidden');
                    setTimeout(() => {
                        list.classList.remove('opacity-0', '-translate-y-2');
                        icon.classList.add('rotate-180');
                    }, 10);
                } else {
                    list.classList.add('opacity-0', '-translate-y-2');
                    icon.classList.remove('rotate-180');
                    setTimeout(() => list.classList.add('hidden'), 200);
                }
            };

            // 點擊選項
            list.querySelectorAll('.opt-type-option').forEach(optEl => {
                optEl.onclick = (e) => {
                    e.stopPropagation();
                    const newVal = optEl.dataset.value;
                    const oldVal = editingOptions[idx].type;

                    if (newVal !== oldVal) {
                        editingOptions[idx].type = newVal;
                        if (newVal === 'text') {
                            editingOptions[idx].choices = []; // 文字不需要細項
                        } else if (editingOptions[idx].choices.length === 0) {
                            editingOptions[idx].choices = [{ label: '', price: 0 }]; // 切回選擇題給個預設空項
                        }
                        renderOptionsEditor(); // 重新渲染整個區塊
                    } else {
                        // 只是關閉
                        list.classList.add('opacity-0', '-translate-y-2');
                        icon.classList.remove('rotate-180');
                        setTimeout(() => list.classList.add('hidden'), 200);
                    }
                };
            });
        });

        // 點擊畫面空白處，關閉所有下拉選單
        document.addEventListener('click', () => {
            document.querySelectorAll('.opt-type-list:not(.hidden)').forEach(list => {
                list.classList.add('opacity-0', '-translate-y-2');
                const icon = list.previousElementSibling.querySelector('.dropdown-icon');
                if (icon) icon.classList.remove('rotate-180');
                setTimeout(() => list.classList.add('hidden'), 200);
            });
        }, { once: false });

        // 2. 標題輸入
        container.querySelectorAll('.opt-label-input').forEach(el => {
            el.addEventListener('input', (e) => {
                editingOptions[e.target.dataset.idx].label = e.target.value;
            });
        });

        // 3. 必填 Checkbox
        container.querySelectorAll('.opt-required-checkbox').forEach(el => {
            el.addEventListener('change', (e) => {
                editingOptions[e.target.dataset.idx].required = e.target.checked;
            });
        });

        // 4. 刪除整個欄位
        container.querySelectorAll('.btn-remove-opt').forEach(el => {
            el.addEventListener('click', (e) => {
                editingOptions.splice(e.target.dataset.idx, 1);
                renderOptionsEditor();
            });
        });

        // 5. 新增細項
        container.querySelectorAll('.btn-add-choice').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = e.target.dataset.idx;
                if (!editingOptions[idx].choices) editingOptions[idx].choices = [];
                editingOptions[idx].choices.push({ label: '', price: 0 });
                renderOptionsEditor();
            });
        });

        // 6. 刪除細項
        container.querySelectorAll('.btn-remove-choice').forEach(el => {
            el.addEventListener('click', (e) => {
                const optIdx = e.target.dataset.optIdx;
                const choiceIdx = e.target.dataset.choiceIdx;
                editingOptions[optIdx].choices.splice(choiceIdx, 1);
                renderOptionsEditor();
            });
        });

        // 7. 細項名稱輸入
        container.querySelectorAll('.choice-label').forEach(el => {
            el.addEventListener('input', (e) => {
                const optIdx = e.target.dataset.optIdx;
                const choiceIdx = e.target.dataset.choiceIdx;
                editingOptions[optIdx].choices[choiceIdx].label = e.target.value;
            });
        });

        // 8. 細項價格輸入
        container.querySelectorAll('.choice-price').forEach(el => {
            el.addEventListener('input', (e) => {
                const optIdx = e.target.dataset.optIdx;
                const choiceIdx = e.target.dataset.choiceIdx;
                editingOptions[optIdx].choices[choiceIdx].price = parseInt(e.target.value) || 0;
            });
        });
    }

    // 點擊最外層「新增欄位」按鈕
    const btnAddOption = document.getElementById('btn-add-option');
    if (btnAddOption) {
        // 移除舊的綁定，防止重複觸發
        const newBtn = btnAddOption.cloneNode(true);
        btnAddOption.parentNode.replaceChild(newBtn, btnAddOption);

        newBtn.addEventListener('click', () => {
            editingOptions.push({
                label: '',
                type: 'radio',
                required: false,
                choices: [{ label: '', price: 0 }],
                sort_order: editingOptions.length
            });
            renderOptionsEditor();
        });
    }

    // 匯出儲存函數，給 dashboard.js 呼叫
    window.saveProductOptions = async function (productId, storeId) {
        try {
            await window.supabaseClient.from('product_options').delete().eq('product_id', productId);

            const validOptions = editingOptions.filter(opt => opt.label.trim() !== '');
            if (validOptions.length === 0) return;

            const payload = validOptions.map((opt, i) => {
                let cleanChoices = null;
                if (opt.type !== 'text' && opt.choices) {
                    cleanChoices = opt.choices.filter(c => c.label.trim() !== '').map(c => ({
                        label: c.label.trim(),
                        price: parseInt(c.price) || 0
                    }));
                }

                return {
                    store_id: storeId,
                    product_id: productId,
                    label: opt.label.trim(),
                    type: opt.type,
                    required: opt.required,
                    choices: cleanChoices,
                    sort_order: i
                };
            });

            const { error } = await window.supabaseClient.from('product_options').insert(payload);
            if (error) throw error;

        } catch (err) {
            console.error('儲存客製化選項失敗:', err);
            throw err;
        }
    };
})();