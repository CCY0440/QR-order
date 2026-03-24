// =============================================
// reports.js — 營收報表 (含高質感日曆與 🌟 獨家熱門客製化分析)
// =============================================
(async function () {
    let storeId = null;
    let revenueChart = null;
    let paymentChart = null;

    async function getStoreId() {
        if (storeId) return storeId;
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return null;
        const { data: store } = await window.supabaseClient.from('stores').select('id').eq('owner_id', user.id).single();
        if (store) storeId = store.id;
        return storeId;
    }

    // 將日期轉成 YYYY-MM-DD 格式
    function formatDateForInput(date) {
        const d = new Date(date);
        const month = '' + (d.getMonth() + 1);
        const day = '' + d.getDate();
        const year = d.getFullYear();
        return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
    }

    // 計算快速區間的 Start 與 End
    function getQuickRange(period) {
        const now = new Date();
        let start = new Date(now);
        let end = new Date(now);

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (period === 'week') {
            start.setDate(now.getDate() - 6);
        } else if (period === 'month') {
            start.setDate(1);
        }
        return { start, end };
    }

    const startDateInput = document.getElementById('report-start-date');
    const endDateInput = document.getElementById('report-end-date');
    const quickBtns = document.querySelectorAll('.report-filter-btn');

    let fpStart = null;
    let fpEnd = null;
    if (typeof flatpickr !== 'undefined') {
        fpStart = flatpickr(startDateInput, {
            dateFormat: "Y-m-d",
            disableMobile: true,
            locale: "zh_tw"
        });
        fpEnd = flatpickr(endDateInput, {
            dateFormat: "Y-m-d",
            disableMobile: true,
            locale: "zh_tw"
        });
    }

    window.loadReports = async function (startInputStr, endInputStr) {
        const id = await getStoreId();
        if (!id) return;

        let startDate, endDate;

        if (startInputStr && endInputStr) {
            startDate = new Date(startInputStr);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(endInputStr);
            endDate.setHours(23, 59, 59, 999);
        } else {
            if (startDateInput && startDateInput.value && endDateInput && endDateInput.value) {
                startDate = new Date(startDateInput.value);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(endDateInput.value);
                endDate.setHours(23, 59, 59, 999);
            } else {
                const range = getQuickRange('today');
                startDate = range.start;
                endDate = range.end;

                if (fpStart) fpStart.setDate(startDate);
                else if (startDateInput) startDateInput.value = formatDateForInput(startDate);

                if (fpEnd) fpEnd.setDate(endDate);
                else if (endDateInput) endDateInput.value = formatDateForInput(endDate);
            }
        }

        const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));

        // 🌟 核心修改 1：確保 select 裡面有抓取 options 欄位
        const { data: orders } = await window.supabaseClient
            .from('orders')
            .select('id, store_id, status, total_price, payment_method, is_paid, created_at, order_items(product_name, quantity, options)')
            .eq('store_id', id)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .neq('status', 'cancelled');

        const data = orders || [];
        renderSummary(data);
        renderTrendChart(data, startDate, daysDiff);
        renderPaymentChart(data);
        renderTopItems(data);
    };

    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            quickBtns.forEach(b => {
                b.classList.remove('active', 'bg-white', 'text-emerald-600', 'shadow-sm');
                b.classList.add('text-gray-500');
            });
            btn.classList.add('active', 'bg-white', 'text-emerald-600', 'shadow-sm');
            btn.classList.remove('text-gray-500');

            const range = getQuickRange(btn.dataset.range);

            if (fpStart) fpStart.setDate(range.start);
            else if (startDateInput) startDateInput.value = formatDateForInput(range.start);

            if (fpEnd) fpEnd.setDate(range.end);
            else if (endDateInput) endDateInput.value = formatDateForInput(range.end);

            window.loadReports(startDateInput.value, endDateInput.value);
        });
    });

    const btnCustomReport = document.getElementById('btn-custom-report');
    if (btnCustomReport) {
        btnCustomReport.addEventListener('click', () => {
            const sVal = startDateInput?.value;
            const eVal = endDateInput?.value;

            if (!sVal || !eVal) {
                window.AppDialog.alert('請選擇完整的開始與結束日期！', 'warning');
                return;
            }
            if (new Date(sVal) > new Date(eVal)) {
                window.AppDialog.alert('開始日期不能晚於結束日期喔！', 'warning');
                return;
            }

            quickBtns.forEach(b => {
                b.classList.remove('active', 'bg-white', 'text-emerald-600', 'shadow-sm');
                b.classList.add('text-gray-500');
            });

            window.loadReports(sVal, eVal);
        });
    }

    function renderSummary(orders) {
        const completed = orders.filter(o => o.status === 'completed');
        const revenue = completed.reduce((s, o) => s + (o.total_price || 0), 0);
        const avg = completed.length ? Math.round(revenue / completed.length) : 0;
        const paid = orders.filter(o => o.is_paid).length;

        document.getElementById('rp-revenue').textContent = revenue.toLocaleString();
        document.getElementById('rp-orders').textContent = orders.length;
        document.getElementById('rp-avg').textContent = avg.toLocaleString();
        document.getElementById('rp-paid').textContent = paid;
    }

    function renderTrendChart(orders, start, days) {
        const labels = [];
        const values = [];

        if (days === 1) {
            const currentHour = start.toDateString() === new Date().toDateString() ? new Date().getHours() : 23;
            for (let h = 0; h <= currentHour; h++) {
                labels.push(`${h}:00`);
                const total = orders
                    .filter(o => new Date(o.created_at).getHours() === h && o.status === 'completed')
                    .reduce((s, o) => s + (o.total_price || 0), 0);
                values.push(total);
            }
        } else {
            for (let i = 0; i < days; i++) {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
                const total = orders
                    .filter(o => new Date(o.created_at).toDateString() === d.toDateString() && o.status === 'completed')
                    .reduce((s, o) => s + (o.total_price || 0), 0);
                values.push(total);
            }
        }

        const ctx = document.getElementById('chart-revenue')?.getContext('2d');
        if (!ctx) return;

        if (revenueChart) revenueChart.destroy();
        revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '營業額',
                    data: values,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.08)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => `NT$${v.toLocaleString()}`, font: { size: 11 } },
                        grid: { color: '#f3f4f6' }
                    },
                    x: { ticks: { font: { size: 11 } }, grid: { display: false } }
                }
            }
        });
    }

    function renderPaymentChart(orders) {
        const counts = {};
        const labels = { cash: '現金', card: '刷卡', linepay: '行動支付' };
        const colors = { cash: '#10b981', card: '#3b82f6', linepay: '#00b900' };

        orders.forEach(o => {
            const m = o.payment_method || 'cash';
            counts[m] = (counts[m] || 0) + 1;
        });

        const keys = Object.keys(counts);
        const ctx = document.getElementById('chart-payment')?.getContext('2d');
        if (!ctx || keys.length === 0) {
            if (paymentChart) {
                paymentChart.destroy();
                paymentChart = null;
            }
            const legend = document.getElementById('chart-payment-legend');
            if (legend) legend.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">該區間尚無付款資料</p>';
            return;
        }

        if (paymentChart) paymentChart.destroy();
        paymentChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: keys.map(k => labels[k] || k),
                datasets: [{ data: keys.map(k => counts[k]), backgroundColor: keys.map(k => colors[k] || '#9ca3af'), borderWidth: 0, hoverOffset: 4 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                cutout: '70%'
            }
        });

        const legend = document.getElementById('chart-payment-legend');
        if (legend) {
            const total = Object.values(counts).reduce((s, v) => s + v, 0);
            legend.innerHTML = keys.map(k => `
                <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full inline-block" style="background:${colors[k] || '#9ca3af'}"></span>
                        <span class="font-medium text-gray-700">${labels[k] || k}</span>
                    </div>
                    <span class="font-bold text-gray-800">${counts[k]} 筆 <span class="text-gray-400 font-normal">(${Math.round(counts[k] / total * 100)}%)</span></span>
                </div>`).join('');
        }
    }

    // 🌟 核心修改 2：加入熱門客製化選項分析
    function renderTopItems(orders) {
        const itemStats = {};

        // 遍歷所有非取消的訂單明細
        orders.forEach(o => {
            if (o.status !== 'cancelled') {
                (o.order_items || []).forEach(item => {
                    const name = item.product_name;
                    const qty = item.quantity;
                    const opts = item.options;

                    // 初始化該餐點的統計物件
                    if (!itemStats[name]) {
                        itemStats[name] = { totalQty: 0, optionCounts: {} };
                    }

                    itemStats[name].totalQty += qty;

                    // 如果這筆點單有客製化選項，進行組合計票
                    if (opts && Object.keys(opts).length > 0) {
                        let optionStrings = [];
                        Object.values(opts).forEach(opt => {
                            if (opt.choices) {
                                optionStrings.push(opt.choices.map(c => c.label).join('、'));
                            } else if (opt.value) {
                                optionStrings.push(opt.value);
                            }
                        });

                        // 將所有選項組合成一個字串當作 Key，例如 "少冰, 半糖, 加珍珠"
                        const optionComboKey = optionStrings.filter(Boolean).join(', ');

                        if (optionComboKey) {
                            itemStats[name].optionCounts[optionComboKey] = (itemStats[name].optionCounts[optionComboKey] || 0) + qty;
                        }
                    }
                });
            }
        });

        // 排序：依據總銷量遞減，只取前 10 名
        const sortedItems = Object.entries(itemStats)
            .sort((a, b) => b[1].totalQty - a[1].totalQty)
            .slice(0, 10);

        const maxQty = sortedItems[0]?.[1].totalQty || 1;
        const container = document.getElementById('rp-top-items');
        if (!container) return;

        if (sortedItems.length === 0) {
            container.innerHTML = '<p class="p-8 text-center text-gray-400 text-sm">該區間尚無熱銷資料</p>';
            return;
        }

        container.innerHTML = sortedItems.map(([name, stats], i) => {
            const count = stats.totalQty;

            // 找出該餐點最受歡迎的客製化組合 (票數最高者)
            let topOptionString = '';
            if (Object.keys(stats.optionCounts).length > 0) {
                const topOption = Object.entries(stats.optionCounts)
                    .sort((a, b) => b[1] - a[1])[0]; // 取票數最高的第一名

                // 只有當該客製化的選擇次數超過總銷量的 20% 時，才值得顯示為「熱門偏好」
                if (topOption[1] >= (count * 0.2)) {
                    topOptionString = `
                        <div class="mt-1 flex items-center gap-1">
                            <span class="bg-amber-50 text-amber-600 text-[10px] font-black px-1.5 py-0.5 rounded border border-amber-100 flex items-center"><i data-lucide="sparkles" class="w-3 h-3 mr-0.5"></i> 熱門偏好</span>
                            <span class="text-[11px] text-gray-500 font-medium truncate">${topOption[0]}</span>
                        </div>
                    `;
                }
            }

            return `
            <div class="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                <span class="w-6 text-center font-black text-sm mt-0.5 ${i < 3 ? 'text-emerald-500' : 'text-gray-300'}">${i + 1}</span>
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-gray-800 text-sm truncate">${name}</p>
                    ${topOptionString}
                    <div class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full bg-emerald-400 rounded-full transition-all duration-500" style="width:${Math.round(count / maxQty * 100)}%"></div>
                    </div>
                </div>
                <div class="flex flex-col items-end shrink-0">
                    <span class="font-black text-gray-700 text-sm">${count} <span class="text-xs font-bold text-gray-400">份</span></span>
                </div>
            </div>`;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
})();