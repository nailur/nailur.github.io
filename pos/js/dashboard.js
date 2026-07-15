window.revenueChartInst = null;
window.productChartInst = null;

window.loadDashboard = async function() {
    if (!activeOutletId) return;

    if (!window.Chart) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
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
    const dailyData = analyticsResult.daily_revenue || [];
    const topProducts = analyticsResult.top_products || [];

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

    const methodLabels = methodData.map(x => x.method || 'Tunai');
    const methodValues = methodData.map(x => x.total);
    
    if (window.methodsChartInst) window.methodsChartInst.destroy();
    window.methodsChartInst = new Chart(methodCtx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: methodLabels,
            datasets: [{
                label: 'Omzet per Metode (Rp)',
                data: methodValues,
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });


};
