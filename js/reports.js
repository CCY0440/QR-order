// =============================================
// reports.js — 營收報表
// =============================================
(async function () {
    let storeId = null;
    let currentPeriod = 'day';
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

    window.loadReports = async function (period) {
        if (period) currentPeriod = period;
        const id = await getStoreId();
        if (!id) return;

        const { start, days } = getRange(currentPeriod);

        const { data: orders } = await window.supabaseClient
            .from('orders')
            .select('id, store_id, status, total_price, payment_method, is_paid, created_at, order_items(product_name, quantity)')
            .eq('store_id', id)
            .gte('created_at', start.toISOString())
            .neq('status', 'cancelled');

        const data = orders || [];
        renderSummary(data);
        renderTrendChart(data, start, days);
        renderPaymentChart(data);
        renderTopItems(data);
    };

    function getRange(period) {
        const now = new Date();
        if (period === 'day') {
            const s = new Date(now); s.setHours(0, 0, 0, 0);
            return { start: s, days: 1 };
        }
        if (period === 'week') {
            const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0, 0, 0, 0);
            return { start: s, days: 7 };
        }
        const s = new Date(now); s.setDate(1); s.setHours(0, 0, 0, 0);
        return { start: s, days: now.getDate() };
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
            // 今日：按小時（0–現在）
            const currentHour = new Date().getHours();
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
        const labels = { cash: '現金', card: '刷卡', linepay: 'Line Pay' };
        const colors = { cash: '#10b981', card: '#3b82f6', linepay: '#00b900' };

        orders.forEach(o => {
            const m = o.payment_method || 'cash';
            counts[m] = (counts[m] || 0) + 1;
        });

        const keys = Object.keys(counts);
        const ctx = document.getElementById('chart-payment')?.getContext('2d');
        if (!ctx || keys.length === 0) return;

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

    function renderTopItems(orders) {
        const itemCounts = {};
        orders.forEach(o => {
            (o.order_items || []).forEach(item => {
                const n = item.product_name;
                itemCounts[n] = (itemCounts[n] || 0) + item.quantity;
            });
        });

        const sorted = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const max = sorted[0]?.[1] || 1;
        const container = document.getElementById('rp-top-items');
        if (!container) return;

        if (sorted.length === 0) {
            container.innerHTML = '<p class="p-8 text-center text-gray-400 text-sm">尚無資料</p>';
            return;
        }

        container.innerHTML = sorted.map(([name, count], i) => `
            <div class="px-6 py-3.5 flex items-center gap-4">
                <span class="w-6 text-center font-black text-sm ${i < 3 ? 'text-emerald-500' : 'text-gray-300'}">${i + 1}</span>
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-gray-800 text-sm truncate">${name}</p>
                    <div class="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full bg-emerald-400 rounded-full transition-all duration-500" style="width:${Math.round(count / max * 100)}%"></div>
                    </div>
                </div>
                <span class="font-black text-gray-700 text-sm shrink-0">${count} 份</span>
            </div>`).join('');
    }

    // 週期切換按鈕
    document.querySelectorAll('.report-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.report-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.loadReports(btn.dataset.period);
        });
    });
})();