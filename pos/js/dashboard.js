window.revenueChartInst = null;
window.productChartInst = null;
window.depositCompChartInst = null;
window.profitSharingChartInst = null;

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
                        methodFee = (amt * (Number(feeCfg.value) / 100));
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
        return rev - fees - expense;
    });

    // Net Revenue Cash = Cash Revenue - Expenses (per day)
    const netCashRevenueData = compDates.map(d => {
        const cash = salesByDate[d] ? salesByDate[d].cash : 0;
        const expense = expensesByDate[d] || 0;
        return cash - expense;
    });

    const depositData = compDates.map(d => depositsByDate[d] || 0);

    // Calculate difference (selisih) per day: Setoran - Omset Bersih Cash
    // Jika Setoran < Omset Cash -> Negatif (Kurang Setor, akan berwarna merah)
    const selisihData = compDates.map((d, i) => depositData[i] - netCashRevenueData[i]);

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

    const extraMethods = ['Go Food', 'Grab Food', 'Shopee Food', 'QRIS', 'Bank Transfer'];
    const extraColors = ['#e11d48', '#16a34a', '#ea580c', '#0284c7', '#7c3aed']; // Vibrant identifiable colors
    
    extraMethods.forEach((method, i) => {
        const methodData = compDates.map(d => {
            return salesByDate[d] && salesByDate[d].methodNet[method] ? salesByDate[d].methodNet[method] : 0;
        });
        
        // Only include dataset if there is actually data in the selected period to avoid extreme clutter
        if (methodData.some(val => val > 0)) {
            baseDatasets.push({
                label: `Omset Bersih ${method} (Rp)`,
                data: methodData,
                backgroundColor: extraColors[i % extraColors.length],
                borderRadius: 4,
                datalabels: { ...whiteLabelOpts }
            });
        }
    });

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

    // ── Chart 3: Estimasi Bagi Hasil ────────────────────────

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
