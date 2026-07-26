window.revenueChartInst = null;
window.productChartInst = null;
window.depositCompChartInst = null;
window.profitSharingChartInst = null;
window.peakHoursChartInst = null;

window.loadDashboard = async function() {
    if (!activeOutletId) return;

    if (!window.Chart || !window.ChartDataLabels) {
        if (!window.Chart) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        if (!window.ChartDataLabels) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        window.Chart.register(window.ChartDataLabels);
    }
    
    const startDate = document.getElementById('dashboard-date-start');
    const endDate = document.getElementById('dashboard-date-end');
    if (!startDate || !startDate.value || !endDate || !endDate.value) return;

    const startOfDay = new Date(`${startDate.value}T00:00:00`).toISOString();
    const endOfDay = new Date(`${endDate.value}T23:59:59.999`).toISOString();

    // Fetch dashboard summary
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_dashboard_summary', {
        p_outlet_id: activeOutletId,
        p_start_date: startOfDay,
        p_end_date: endOfDay
    });

    // Fetch analytics summary for charts
    const { data: analyticsResult, error: analyticsError } = await supabase.rpc('get_analytics_summary', {
        p_outlet_ids: [activeOutletId],
        p_start_date: startOfDay
    });

    if (rpcError || analyticsError) {
        console.error('Dashboard RPC error:', rpcError || analyticsError);
        window.showToast('Gagal memuat dashboard', 'error');
        return;
    }

    const result = rpcResult;
    const totalRevenue = Number(result.total_revenue) || 0;
    const totalTrx = Number(result.total_trx) || 0;
    const totalDiscount = Number(result.total_discount) || 0;
    const totalTax = Number(result.total_tax) || 0;
    const methodData = result.method_summary || [];
    const productData = result.product_summary || [];

    document.getElementById('dash-total-revenue').textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
    document.getElementById('dash-total-trx').textContent = totalTrx;
    document.getElementById('dash-total-discount').textContent = `Rp ${totalDiscount.toLocaleString('id-ID')}`;
    
    const dashTaxEl = document.getElementById('dash-total-tax');
    if (dashTaxEl) dashTaxEl.textContent = `Rp ${totalTax.toLocaleString('id-ID')}`;

    const totalVoidAmt = Number(result.total_void_amount) || 0;
    const totalVoidTrx = Number(result.total_void_trx) || 0;
    const dashVoidAmtEl = document.getElementById('dash-total-void-amount');
    const dashVoidTrxEl = document.getElementById('dash-total-void-trx');
    if (dashVoidAmtEl) dashVoidAmtEl.textContent = `Rp ${totalVoidAmt.toLocaleString('id-ID')}`;
    if (dashVoidTrxEl) dashVoidTrxEl.textContent = `${totalVoidTrx} Trx`;

    // Build method summary with defaults
    const ALL_PAYMENT_METHODS = ['Tunai', 'QRIS', 'Bank Transfer', 'Go Food', 'Grab Food', 'Shopee Food'];
    const methodSummary = {};
    ALL_PAYMENT_METHODS.forEach(m => methodSummary[m] = { count: 0, total: 0 });
    methodData.forEach(m => {
        const key = m.method || 'Tunai';
        methodSummary[key] = { count: Number(m.count), total: Number(m.total) };
    });

    const tbodyMethod = document.querySelector('#dashboard-method-table tbody');
    tbodyMethod.innerHTML = Object.entries(methodSummary)
        .sort((a,b) => b[1].total - a[1].total)
        .map(([method, stats]) => `
        <tr>
            <td>${window.escapeHtml(method)}</td>
            <td style="text-align: right;">${stats.count}</td>
            <td style="text-align: right;">Rp ${stats.total.toLocaleString('id-ID')}</td>
        </tr>
    `).join('');

    const tbodyProduct = document.querySelector('#dashboard-product-table tbody');
    if (productData.length === 0) {
        tbodyProduct.innerHTML = '<tr><td colspan="3" class="text-center">Belum ada data</td></tr>';
    } else {
        tbodyProduct.innerHTML = productData.map(p => `
            <tr>
                <td>${window.escapeHtml(p.name)}</td>
                <td style="text-align: right;">${Number(p.qty)}</td>
                <td style="text-align: right;">Rp ${Number(p.revenue).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    }
    
    if (window.enableTableSort) window.enableTableSort('dashboard-method-table');
    if (window.enableTableSort) window.enableTableSort('dashboard-product-table');

    // Render Charts
    let dailyData = analyticsResult.daily_revenue || [];
    const topProducts = analyticsResult.top_products || [];

    // Filter out dates that are past the selected endDate
    // (Because get_analytics_summary only accepts p_start_date and returns all data onwards)
    if (endDate && endDate.value) {
        dailyData = dailyData.filter(d => d.date <= endDate.value);
    }

    const revCtx = document.getElementById('revenueChart');
    if(!revCtx) return;

    const { data: costsData } = await supabase
        .from('operational_costs')
        .select('cost_date, total_amount')
        .eq('outlet_id', activeOutletId)
        .gte('cost_date', startDate.value)
        .lte('cost_date', endDate.value);
        
    const expensesByDate = {};
    const allDatesSet = new Set(dailyData.map(d => d.date));
    
    if (costsData) {
        costsData.forEach(c => {
            allDatesSet.add(c.cost_date);
            expensesByDate[c.cost_date] = (expensesByDate[c.cost_date] || 0) + Number(c.total_amount);
        });
    }
    
    const allDates = Array.from(allDatesSet).sort();
    const chartLabels = allDates.map(d => new Date(d).toLocaleDateString('id-ID', {day: 'numeric', month:'short'}));
    
    const revData = allDates.map(d => {
        const found = dailyData.find(x => x.date === d);
        return found ? found.revenue : 0;
    });
    
    const expData = allDates.map(d => expensesByDate[d] || 0);

    // Shared datalabel options (white text for readability)
    const whiteLabelOpts = {
        color: '#ffffff',
        font: { weight: 'bold', size: 11 },
        anchor: 'center',
        align: 'center',
        formatter: (val) => val > 0 ? val.toLocaleString('id-ID') : ''
    };

    if (window.revenueChartInst) window.revenueChartInst.destroy();
    window.revenueChartInst = new Chart(revCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: 'Pendapatan (Rp)',
                    data: revData,
                    backgroundColor: '#6366f1',
                    borderRadius: 4,
                    datalabels: whiteLabelOpts
                },
                {
                    label: 'Pengeluaran (Rp)',
                    data: expData,
                    backgroundColor: '#ef4444',
                    borderRadius: 4,
                    datalabels: whiteLabelOpts
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // ── Chart 2: Omset Bersih vs Setoran ────────────────────────

    const depCtx = document.getElementById('depositComparisonChart');
    if (!depCtx) return;

    // Fetch deposits within date range
    const { data: depositsData } = await supabase
        .from('sales_deposits')
        .select('deposit_date, amount')
        .eq('outlet_id', activeOutletId)
        .gte('deposit_date', startDate.value)
        .lte('deposit_date', endDate.value);

    const depositsByDate = {};
    if (depositsData) {
        depositsData.forEach(d => {
            depositsByDate[d.deposit_date] = (depositsByDate[d.deposit_date] || 0) + Number(d.amount);
        });
    }

    // Fetch raw sales for Cash vs Total revenue calculation
    const { data: salesData } = await supabase
        .from('transactions')
        .select('created_at, total_amount, payment_method, status')
        .eq('outlet_id', activeOutletId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .eq('status', 'completed');

    const salesByDate = {};
    if (salesData) {
        salesData.forEach(s => {
            const dateStr = new Date(s.created_at);
            dateStr.setMinutes(dateStr.getMinutes() - dateStr.getTimezoneOffset());
            const localDate = dateStr.toISOString().split('T')[0];
            
            if (!salesByDate[localDate]) {
                salesByDate[localDate] = { total: 0, cash: 0, fees: 0, methodNet: {} };
            }
            const amt = Number(s.total_amount);
            salesByDate[localDate].total += amt;
            if (s.payment_method === 'Tunai') {
                salesByDate[localDate].cash += amt;
            }
            
            let methodFee = 0;
            if (s.payment_method !== 'Tunai') {
                // Hitung potongan MDR
                const activeOutletObj = window.posOutletsList?.find(o => o.id === activeOutletId);
                if (activeOutletObj && activeOutletObj.mdr_fees && activeOutletObj.mdr_fees[s.payment_method]) {
                    const feeCfg = activeOutletObj.mdr_fees[s.payment_method];
                    if (feeCfg.type === 'percent') {
                        methodFee = amt * (Number(feeCfg.value) / 100);
                    } else if (feeCfg.type === 'fixed') {
                        methodFee = Number(feeCfg.value);
                    }
                }
            }
            salesByDate[localDate].fees += methodFee;
            
            const netForThisTx = amt - methodFee;
            if (!salesByDate[localDate].methodNet[s.payment_method]) {
                salesByDate[localDate].methodNet[s.payment_method] = 0;
            }
            salesByDate[localDate].methodNet[s.payment_method] += netForThisTx;
        });
    }

    // Merge dates for a unified x-axis
    const compDatesSet = new Set(allDates);
    Object.keys(depositsByDate).forEach(d => compDatesSet.add(d));
    Object.keys(salesByDate).forEach(d => compDatesSet.add(d));
    const compDates = Array.from(compDatesSet).sort();
    const compLabels = compDates.map(d => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));

    // Net Revenue Total = Total Revenue - Total Fees - Expenses (per day)
    const netTotalRevenueData = compDates.map(d => {
        const rev = salesByDate[d] ? salesByDate[d].total : 0;
        const fees = salesByDate[d] ? salesByDate[d].fees : 0;
        const expense = expensesByDate[d] || 0;
        return Math.round(rev - fees - expense);
    });

    // Net Revenue Cash = Cash Revenue - Expenses (per day)
    const netCashRevenueData = compDates.map(d => {
        const cash = salesByDate[d] ? salesByDate[d].cash : 0;
        const expense = expensesByDate[d] || 0;
        return Math.round(cash - expense);
    });

    const depositData = compDates.map(d => depositsByDate[d] || 0);

    // Calculate difference (selisih) per day: Setoran - Omset Bersih Cash
    // Jika Setoran < Omset Cash -> Negatif (Kurang Setor, akan berwarna merah)
    const selisihData = compDates.map((d, i) => Math.round(depositData[i] - netCashRevenueData[i]));

    const baseDatasets = [
        {
            label: 'Omset Bersih Seluruh (Rp)',
            data: netTotalRevenueData,
            backgroundColor: '#10b981',
            borderRadius: 4,
            datalabels: { ...whiteLabelOpts }
        },
        {
            label: 'Omset Bersih Cash (Rp)',
            data: netCashRevenueData,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            datalabels: { ...whiteLabelOpts }
        }
    ];

    baseDatasets.push(
        {
            label: 'Setoran (Rp)',
            data: depositData,
            backgroundColor: '#8b5cf6',
            borderRadius: 4,
            datalabels: { ...whiteLabelOpts }
        },
        {
            label: 'Selisih (Rp)',
            data: selisihData,
            backgroundColor: selisihData.map(v => v < 0 ? '#ef4444' : '#f59e0b'),
            borderRadius: 4,
            datalabels: { ...whiteLabelOpts }
        }
    );

    if (window.depositCompChartInst) window.depositCompChartInst.destroy();
    window.depositCompChartInst = new Chart(depCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: compLabels,
            datasets: baseDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // ── Chart: Jam Sibuk Transaksi (Peak Hours 00:00 - 23:00) ────────
    const peakCtx = document.getElementById('peakHoursChart');
    if (peakCtx) {
        const hourlyCounts = new Array(24).fill(0);
        const hourlyRevenues = new Array(24).fill(0);
        if (salesData) {
            salesData.forEach(s => {
                const dt = new Date(s.created_at);
                const hour = dt.getHours();
                hourlyCounts[hour] += 1;
                hourlyRevenues[hour] += (Number(s.total_amount) || 0);
            });
        }
        const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

        if (window.peakHoursChartInst) window.peakHoursChartInst.destroy();
        window.peakHoursChartInst = new Chart(peakCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: hourLabels,
                datasets: [{
                    label: 'Jumlah Transaksi (Trx)',
                    data: hourlyCounts,
                    backgroundColor: '#6366f1',
                    borderRadius: 4,
                    datalabels: {
                        color: '#ffffff',
                        font: { weight: 'bold', size: 10 },
                        formatter: (val) => val > 0 ? val : ''
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { maxRotation: 45, minRotation: 0 }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const hr = context.dataIndex;
                                const rev = hourlyRevenues[hr] || 0;
                                return `Omzet: Rp ${rev.toLocaleString('id-ID')}`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ── Chart 3: Estimasi Bagi Hasil & Estimasi Laba Bersih ────────

    const profitCtx = document.getElementById('profitSharingChart');
    if (!profitCtx) return;

    // Total Omset Bersih for the selected period
    const totalNetRevenue = netTotalRevenueData.reduce((sum, val) => sum + val, 0);
    const THRESHOLD = 3500000;

    let ownerShare = 0;
    let investorShare = 0;

    if (totalNetRevenue > THRESHOLD) {
        // Tahap 1: Up to Threshold
        ownerShare += THRESHOLD * 0.8;
        investorShare += THRESHOLD * 0.2;
        
        // Tahap 2: Above Threshold
        const remaining = totalNetRevenue - THRESHOLD;
        ownerShare += remaining * 0.75;
        investorShare += remaining * 0.25;
    } else {
        // Tahap 1 only
        ownerShare += totalNetRevenue * 0.8;
        investorShare += totalNetRevenue * 0.2;
    }

    if (window.profitSharingChartInst) window.profitSharingChartInst.destroy();
    window.profitSharingChartInst = new Chart(profitCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Bisnis Owner', 'Investor'],
            datasets: [{
                data: [Math.round(ownerShare), Math.round(investorShare)],
                backgroundColor: ['#3b82f6', '#f59e0b'],
                borderWidth: 0,
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 12 },
                    formatter: (val, ctx) => {
                        const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        if (total === 0) return '';
                        const percentage = Math.round((val / total) * 100) + '%';
                        return `Rp ${val.toLocaleString('id-ID')}\n(${percentage})`;
                    },
                    align: 'center'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: 'var(--text-main)' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: Rp ${context.raw.toLocaleString('id-ID')}`;
                        }
                    }
                }
            }
        }
    });

    // Render Estimasi Laba Bersih Card
    const netProfitCard = document.getElementById('net-profit-card');
    if (netProfitCard) {
        const totalGrossRevenue = Object.values(salesByDate).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        const totalFeesMDR = Object.values(salesByDate).reduce((sum, item) => sum + (Number(item.fees) || 0), 0);
        const totalOperationalExpenses = Object.values(expensesByDate).reduce((sum, val) => sum + Number(val || 0), 0);
        const totalNetProfit = Math.round(totalGrossRevenue - totalFeesMDR - totalOperationalExpenses);

        netProfitCard.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; height: 100%; justify-content: center;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border); padding-bottom: 8px;">
                    <span style="color: var(--text-secondary); font-size: 0.95rem;">Total Pendapatan Kotor</span>
                    <span style="font-weight: 600; color: var(--text-main);">Rp ${totalGrossRevenue.toLocaleString('id-ID')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border); padding-bottom: 8px;">
                    <span style="color: var(--text-secondary); font-size: 0.95rem;">Potongan MDR / Fee</span>
                    <span style="font-weight: 600; color: var(--danger);">- Rp ${totalFeesMDR.toLocaleString('id-ID')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border); padding-bottom: 8px;">
                    <span style="color: var(--text-secondary); font-size: 0.95rem;">Pengeluaran Operasional</span>
                    <span style="font-weight: 600; color: var(--danger);">- Rp ${totalOperationalExpenses.toLocaleString('id-ID')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 10px 12px; border-radius: 6px; margin-top: 4px;">
                    <div>
                        <div style="font-weight: 700; color: #10b981; font-size: 1.05rem;">ESTIMASI LABA BERSIH</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Omset Bersih sebelum Bagi Hasil</div>
                    </div>
                    <div style="font-size: 1.35rem; font-weight: 800; color: #10b981;">Rp ${totalNetProfit.toLocaleString('id-ID')}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 8px 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Bisnis Owner</div>
                        <div style="font-weight: 700; color: #3b82f6; font-size: 0.95rem;">Rp ${Math.round(ownerShare).toLocaleString('id-ID')}</div>
                    </div>
                    <div style="background: rgba(245, 158, 11, 0.1); padding: 8px 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Investor</div>
                        <div style="font-weight: 700; color: #f59e0b; font-size: 0.95rem;">Rp ${Math.round(investorShare).toLocaleString('id-ID')}</div>
                    </div>
                </div>
            </div>
        `;
    }

    window._lastDashboardData = {
        startDate: startDate.value,
        endDate: endDate.value,
        compDates: compDates,
        salesByDate: salesByDate,
        expensesByDate: expensesByDate,
        netTotalRevenueData: netTotalRevenueData,
        ALL_PAYMENT_METHODS: ALL_PAYMENT_METHODS
    };
};

// ── MDR Settings Modal Logic ────────────────────────────────────────

const btnOpenMdr = document.getElementById('btn-open-mdr-settings');
const modalMdr = document.getElementById('modal-mdr');
const formMdr = document.getElementById('form-mdr-settings');
const mdrContainer = document.getElementById('mdr-fields-container');

if (btnOpenMdr) {
    btnOpenMdr.addEventListener('click', () => {
        const activeOutletObj = window.posOutletsList?.find(o => o.id === window.activeOutletId);
        if (!activeOutletObj) return window.showToast('Pilih outlet terlebih dahulu', 'error');

        const currentFees = activeOutletObj.mdr_fees || {};
        
        // Exclude Tunai
        const paymentMethods = window.ALL_PAYMENT_METHODS?.filter(m => m !== 'Tunai') || ['QRIS', 'Bank Transfer', 'Go Food', 'Grab Food', 'Shopee Food'];
        
        mdrContainer.innerHTML = paymentMethods.map(method => {
            const fee = currentFees[method] || { type: 'percent', value: 0 };
            return `
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                    <label style="font-weight: 600; width: 110px; flex-shrink: 0; margin: 0; font-size: 0.9rem;">${method}</label>
                    <select class="input mdr-type" data-method="${method}" style="flex: 1; padding: 6px; font-size: 0.85rem;">
                        <option value="percent" ${fee.type === 'percent' ? 'selected' : ''}>%</option>
                        <option value="fixed" ${fee.type === 'fixed' ? 'selected' : ''}>Rp</option>
                    </select>
                    <input type="number" class="input mdr-value" data-method="${method}" value="${fee.value}" step="any" min="0" style="flex: 2; padding: 6px; font-size: 0.9rem;" placeholder="0">
                </div>
            `;
        }).join('');

        modalMdr.classList.remove('hidden');
    });
}

if (formMdr) {
    formMdr.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newFees = {};
        const types = formMdr.querySelectorAll('.mdr-type');
        const values = formMdr.querySelectorAll('.mdr-value');
        
        for (let i = 0; i < types.length; i++) {
            const method = types[i].dataset.method;
            const type = types[i].value;
            const value = Number(values[i].value) || 0;
            
            if (value > 0) {
                newFees[method] = { type, value };
            }
        }

        try {
            const { error } = await supabase.from('outlets').update({ mdr_fees: newFees }).eq('id', window.activeOutletId);
            if (error) throw error;
            
            window.showToast('Pengaturan potongan MDR berhasil disimpan', 'success');
            modalMdr.classList.add('hidden');
            
            // Update local object
            const activeOutletObj = window.posOutletsList?.find(o => o.id === window.activeOutletId);
            if (activeOutletObj) activeOutletObj.mdr_fees = newFees;
            
            // Reload dashboard to apply
            window.loadDashboard();
        } catch (err) {
            console.error(err);
            window.showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    });
}

// ── Export Dashboard Excel (2 Sheet) ──────────────────────────────────

window.exportDashboardExcel = async function() {
    if (!window._lastDashboardData) {
        return window.showToast('Silakan muat data dashboard terlebih dahulu', 'error');
    }
    const {
        startDate,
        endDate,
        compDates,
        salesByDate,
        expensesByDate,
        ALL_PAYMENT_METHODS
    } = window._lastDashboardData;

    if (!window.XLSX) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './assets/lib/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    if (!window.XLSX) {
        return window.showToast('Library XLSX gagal dimuat', 'error');
    }

    // Sheet 1: Data Pendapatan Kotor dan Pengeluaran
    const sheet1Rows = [];
    let totalGross = 0;
    let totalExp = 0;
    let totalNet = 0;

    compDates.forEach(d => {
        const gross = salesByDate[d] ? Number(salesByDate[d].total || 0) : 0;
        const exp = Number(expensesByDate[d] || 0);
        const net = gross - exp;

        totalGross += gross;
        totalExp += exp;
        totalNet += net;

        sheet1Rows.push({
            "Tanggal": d,
            "Pendapatan Kotor (Rp)": gross,
            "Pengeluaran Operasional (Rp)": exp,
            "Net (Pendapatan - Pengeluaran) (Rp)": net
        });
    });

    sheet1Rows.push({
        "Tanggal": "TOTAL",
        "Pendapatan Kotor (Rp)": totalGross,
        "Pengeluaran Operasional (Rp)": totalExp,
        "Net (Pendapatan - Pengeluaran) (Rp)": totalNet
    });

    // Sheet 2: Data Omset Bersih dari Masing-Masing Payment Method
    const sheet2Rows = [];
    const methodTotals = {};
    ALL_PAYMENT_METHODS.forEach(m => methodTotals[m] = 0);
    let totalAllMethodsSum = 0;

    compDates.forEach(d => {
        const row = { "Tanggal": d };
        let daySum = 0;
        ALL_PAYMENT_METHODS.forEach(m => {
            const val = salesByDate[d] && salesByDate[d].methodNet[m] ? Math.round(salesByDate[d].methodNet[m]) : 0;
            row[`Omset Bersih ${m} (Rp)`] = val;
            methodTotals[m] += val;
            daySum += val;
        });
        row["Total Omset Bersih Hari Ini (Rp)"] = daySum;
        totalAllMethodsSum += daySum;
        sheet2Rows.push(row);
    });

    const totalRow2 = { "Tanggal": "TOTAL" };
    ALL_PAYMENT_METHODS.forEach(m => {
        totalRow2[`Omset Bersih ${m} (Rp)`] = methodTotals[m];
    });
    totalRow2["Total Omset Bersih Hari Ini (Rp)"] = totalAllMethodsSum;
    sheet2Rows.push(totalRow2);

    // Create workbook and append sheets
    const ws1 = window.XLSX.utils.json_to_sheet(sheet1Rows);
    const ws2 = window.XLSX.utils.json_to_sheet(sheet2Rows);

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws1, "Pendapatan & Pengeluaran");
    window.XLSX.utils.book_append_sheet(wb, ws2, "Omset Bersih Payment Method");

    const filenameDate = startDate === endDate ? startDate : `${startDate}_sd_${endDate}`;
    window.XLSX.writeFile(wb, `Laporan_Dashboard_${filenameDate}.xlsx`);
    if (typeof window.showToast === 'function') window.showToast('Laporan Excel berhasil diunduh', 'success');
};

document.addEventListener('DOMContentLoaded', () => {
    const btnExportExcel = document.getElementById('btn-export-dashboard-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', window.exportDashboardExcel);
    }
});

