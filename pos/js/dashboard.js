window.revenueChartInst = null;
window.productChartInst = null;

window.loadAnalytics = async function() {
    const profile = getCurrentProfile();
    // Only management can see
    if (profile?.role === 'kasir') return;
    
    // Populate outlet filter if first time
    const outletSelect = document.getElementById('analytics-outlet-filter');
    if (outletSelect && outletSelect.options.length <= 1) {
        let outlets = outletsList;
        if (profile?.role === 'kepala_cabang') {
            outlets = outletsList.filter(o => o.branch_id === profile.branch_id);
        } else if (profile?.role === 'kepala_toko') {
            outlets = outletsList.filter(o => o.id === profile.outlet_id);
        }
        outlets.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.id;
            opt.textContent = o.name;
            outletSelect.appendChild(opt);
        });
    }

    const period = document.getElementById('analytics-period-filter')?.value || '7';
    const outletFilter = document.getElementById('analytics-outlet-filter')?.value;
    
    // Build outlet IDs array for RPC
    let outletIds = null;
    if (outletFilter) {
        outletIds = [outletFilter];
    } else {
        if (profile?.role === 'kepala_cabang') {
            outletIds = outletsList.filter(o => o.branch_id === profile.branch_id).map(o => o.id);
            if (outletIds.length === 0) return;
        } else if (profile?.role === 'kepala_toko') {
            outletIds = [profile.outlet_id];
        }
    }
    
    const now = new Date();
    const formatLocalISO = (d) => {
        const tzo = -d.getTimezoneOffset();
        const dif = tzo >= 0 ? '+' : '-';
        const pad = num => (num < 10 ? '0' : '') + Math.floor(Math.abs(num));
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 
               'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00' + 
               dif + pad(tzo / 60) + ':' + pad(tzo % 60);
    };

    let startDateStr = '2000-01-01T00:00:00Z'; // fallback for 'all'
    if (period === '7') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        startDateStr = formatLocalISO(d);
    } else if (period === '30') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        startDateStr = formatLocalISO(d);
    } else if (period === 'this_month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        startDateStr = formatLocalISO(d);
    }
    // Try server-side RPC first (much faster & saves bandwidth)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_analytics_summary', {
        p_outlet_ids: outletIds,
        p_start_date: startDateStr
    });

    if (rpcError) {
        console.error('Analytics RPC error:', rpcError);
        window.showToast('Gagal memuat analitik', 'error');
        return;
    }

    const result = rpcResult;
    const totalRevenue = Number(result.total_revenue) || 0;
    const totalItems = Number(result.total_items) || 0;
    const totalDiscount = Number(result.total_discount) || 0;
    const totalTax = Number(result.total_tax) || 0;
    const dailyData = result.daily_revenue || [];
    const topProducts = result.top_products || [];
    const paymentMethods = result.payment_methods || [];

    document.getElementById('analytics-total-revenue').textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
    document.getElementById('analytics-total-trx').textContent = (Number(result.total_trx) || 0).toLocaleString('id-ID');
    document.getElementById('analytics-total-items').textContent = totalItems.toLocaleString('id-ID');
    
    const dashDiscount = document.getElementById('analytics-total-discount');
    if (dashDiscount) dashDiscount.textContent = `Rp ${totalDiscount.toLocaleString('id-ID')}`;
    const dashTax = document.getElementById('analytics-total-tax');
    if (dashTax) dashTax.textContent = `Rp ${totalTax.toLocaleString('id-ID')}`;

    // Fetch attendance count using RPC to bypass RLS
    let attCount = 0;
    if (outletIds && outletIds.length > 0) {
        const stStr = startDateStr.split('T')[0];
        const promises = outletIds.map(oid => supabase.rpc('get_attendance_report', {
            p_start_date: stStr,
            p_end_date: '2099-12-31',
            p_outlet_id: oid
        }));
        const results = await Promise.all(promises);
        results.forEach(r => {
            if (r.data) attCount += r.data.length;
        });
    }
    const dashAtt = document.getElementById('analytics-total-attendance');
    if (dashAtt) dashAtt.textContent = (attCount || 0).toLocaleString('id-ID');

    // Chart.js rendering
    const revCtx = document.getElementById('revenueChart');
    const prodCtx = document.getElementById('productsChart');
    const methodCtx = document.getElementById('methodsChart');
    if(!revCtx || !prodCtx || !methodCtx) return;

    const revLabels = dailyData.map(d => d.date);
    const revData = dailyData.map(d => d.revenue);
    
    if (window.revenueChartInst) window.revenueChartInst.destroy();
    window.revenueChartInst = new Chart(revCtx.getContext('2d'), {
        type: 'line',
        data: {
            labels: revLabels.map(d => new Date(d).toLocaleDateString('id-ID', {day: 'numeric', month:'short'})),
            datasets: [{
                label: 'Pendapatan (Rp)',
                data: revData,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const prodLabels = topProducts.map(x => x.name);
    const prodData = topProducts.map(x => x.qty);

    if (window.productChartInst) window.productChartInst.destroy();
    window.productChartInst = new Chart(prodCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: prodLabels,
            datasets: [{
                data: prodData,
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const methodLabels = paymentMethods.map(x => x.method);
    const methodData = paymentMethods.map(x => x.total);
    
    if (window.methodsChartInst) window.methodsChartInst.destroy();
    window.methodsChartInst = new Chart(methodCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: methodLabels,
            datasets: [{
                label: 'Omzet per Metode (Rp)',
                data: methodData,
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}



window.loadDashboard = async function() {
    if (!activeOutletId) return;
    
    const startDate = document.getElementById('dashboard-date-start');
    const endDate = document.getElementById('dashboard-date-end');
    if (!startDate || !startDate.value || !endDate || !endDate.value) return;

    const startOfDay = new Date(`${startDate.value}T00:00:00`).toISOString();
    const endOfDay = new Date(`${endDate.value}T23:59:59.999`).toISOString();

    // Try server-side RPC first (much faster & saves bandwidth)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_dashboard_summary', {
        p_outlet_id: activeOutletId,
        p_start_date: startOfDay,
        p_end_date: endOfDay
    });

    if (rpcError) {
        console.error('Dashboard RPC error:', rpcError);
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

    // Build method summary with defaults
    const ALL_PAYMENT_METHODS = ['Tunai', 'QRIS', 'Go Food', 'Grab Food', 'Shopee Food'];
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
            <td><strong>${method}</strong></td>
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
                <td>${p.name}</td>
                <td style="text-align: right;">${Number(p.qty)}</td>
                <td style="text-align: right;">Rp ${Number(p.revenue).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    }
    
    if (window.enableTableSort) window.enableTableSort('dashboard-method-table');
    if (window.enableTableSort) window.enableTableSort('dashboard-product-table');
}


