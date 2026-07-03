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
    let startDateStr = null;
    if (period === '7') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        startDateStr = d.toISOString();
    } else if (period === '30') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        startDateStr = d.toISOString();
    } else if (period === 'this_month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        startDateStr = d.toISOString();
    }

    // Try server-side RPC first (much faster & saves bandwidth)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('get_analytics_summary', {
        p_outlet_ids: outletIds,
        p_start_date: startDateStr
    });

    if (rpcError) {
        console.error('Analytics RPC error (falling back to client-side):', rpcError);
        // Fallback: client-side aggregation
        return loadAnalyticsFallback(outletIds, startDateStr);
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

// Fallback: original client-side aggregation (used if RPC not yet deployed)
async function loadAnalyticsFallback(outletIds, startDateStr) {
    let query = supabase.from('transactions').select('*, transaction_items(product_id, quantity, price)');
    
    if (outletIds && outletIds.length === 1) {
        query = query.eq('outlet_id', outletIds[0]);
    } else if (outletIds && outletIds.length > 1) {
        query = query.in('outlet_id', outletIds);
    }
    if (startDateStr) query = query.gte('created_at', startDateStr);

    const { data, error } = await query;
    if (error) { console.error('Analytics fallback error:', error); return; }

    let totalRevenue = 0, totalItems = 0, totalDiscount = 0, totalTax = 0;
    const dailyRevenue = {}, productCounts = {}, methodCounts = {};

    data.forEach(trx => {
        totalRevenue += (trx.total_amount || 0);
        totalDiscount += (trx.discount_amount || 0);
        totalTax += (trx.tax_amount || 0);
        const method = trx.payment_method || 'Tunai';
        methodCounts[method] = (methodCounts[method] || 0) + (trx.total_amount || 0);
        
        const dateKey = trx.created_at.split('T')[0];
        dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + (trx.total_amount || 0);
        if (trx.transaction_items) {
            trx.transaction_items.forEach(item => {
                totalItems += item.quantity;
                const p = products.find(x => x.id === item.product_id);
                productCounts[p ? p.name : 'Unknown'] = (productCounts[p ? p.name : 'Unknown'] || 0) + item.quantity;
            });
        }
    });

    document.getElementById('analytics-total-revenue').textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
    document.getElementById('analytics-total-trx').textContent = data.length.toLocaleString('id-ID');
    document.getElementById('analytics-total-items').textContent = totalItems.toLocaleString('id-ID');

    const dashDiscount = document.getElementById('analytics-total-discount');
    if (dashDiscount) dashDiscount.textContent = `Rp ${totalDiscount.toLocaleString('id-ID')}`;
    const dashTax = document.getElementById('analytics-total-tax');
    if (dashTax) dashTax.textContent = `Rp ${totalTax.toLocaleString('id-ID')}`;

    const revCtx = document.getElementById('revenueChart');
    const prodCtx = document.getElementById('productsChart');
    const methodCtx = document.getElementById('methodsChart');
    if(!revCtx || !prodCtx || !methodCtx) return;

    const revLabels = Object.keys(dailyRevenue).sort();
    const revData = revLabels.map(k => dailyRevenue[k]);
    
    if (window.revenueChartInst) window.revenueChartInst.destroy();
    window.revenueChartInst = new Chart(revCtx.getContext('2d'), {
        type: 'line',
        data: {
            labels: revLabels.map(d => new Date(d).toLocaleDateString('id-ID', {day: 'numeric', month:'short'})),
            datasets: [{ label: 'Pendapatan (Rp)', data: revData, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.3, fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const sortedProducts = Object.entries(productCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
    if (window.productChartInst) window.productChartInst.destroy();
    window.productChartInst = new Chart(prodCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: sortedProducts.map(x => x[0]),
            datasets: [{ data: sortedProducts.map(x => x[1]), backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const sortedMethods = Object.entries(methodCounts).sort((a,b) => b[1] - a[1]);
    if (window.methodsChartInst) window.methodsChartInst.destroy();
    window.methodsChartInst = new Chart(methodCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sortedMethods.map(x => x[0]),
            datasets: [{ label: 'Omzet per Metode (Rp)', data: sortedMethods.map(x => x[1]), backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'] }]
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
        console.error('Dashboard RPC error (falling back to client-side):', rpcError);
        return window.loadDashboardFallback(startOfDay, endOfDay);
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

// Fallback: original client-side dashboard aggregation (used if RPC not yet deployed)
window.loadDashboardFallback = async function(startOfDay, endOfDay) {
    const { data: trxData, error: trxError } = await supabase.from('transactions')
        .select('*')
        .eq('outlet_id', activeOutletId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

    if (trxError) { window.showToast('Gagal memuat data dashboard', 'error'); return; }

    const ALL_PAYMENT_METHODS = ['Tunai', 'QRIS', 'Go Food', 'Grab Food', 'Shopee Food'];
    const methodSummary = {};
    ALL_PAYMENT_METHODS.forEach(m => methodSummary[m] = { count: 0, total: 0 });
    const productSummary = {};
    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalTrx = trxData ? trxData.length : 0;

    if (trxData && trxData.length > 0) {
        const trxIds = trxData.map(t => t.id);
        const { data: itemsData } = await supabase.from('transaction_items')
            .select('*, products(name)')
            .in('transaction_id', trxIds);

        trxData.forEach(trx => {
            const method = trx.payment_method || 'Tunai';
            totalRevenue += (trx.total_amount || 0);
            totalDiscount += (trx.discount_amount || 0);
            if (!methodSummary[method]) methodSummary[method] = { count: 0, total: 0 };
            methodSummary[method].count++;
            methodSummary[method].total += (trx.total_amount || 0);
        });

        if (itemsData) {
            itemsData.forEach(item => {
                const pName = item.products?.name || 'Produk Terhapus';
                if (!productSummary[pName]) productSummary[pName] = { qty: 0, revenue: 0 };
                productSummary[pName].qty += item.quantity;
                productSummary[pName].revenue += (item.quantity * item.price);
            });
        }
    }

    document.getElementById('dash-total-revenue').textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
    document.getElementById('dash-total-trx').textContent = totalTrx;
    document.getElementById('dash-total-discount').textContent = `Rp ${totalDiscount.toLocaleString('id-ID')}`;

    const tbodyMethod = document.querySelector('#dashboard-method-table tbody');
    tbodyMethod.innerHTML = Object.entries(methodSummary)
        .sort((a,b) => b[1].total - a[1].total)
        .map(([method, stats]) => `
        <tr><td><strong>${method}</strong></td><td style="text-align: right;">${stats.count}</td><td style="text-align: right;">Rp ${stats.total.toLocaleString('id-ID')}</td></tr>
    `).join('');

    const tbodyProduct = document.querySelector('#dashboard-product-table tbody');
    if (Object.keys(productSummary).length === 0) {
        tbodyProduct.innerHTML = '<tr><td colspan="3" class="text-center">Belum ada data</td></tr>';
    } else {
        tbodyProduct.innerHTML = Object.entries(productSummary)
            .sort((a,b) => b[1].qty - a[1].qty)
            .map(([name, stats]) => `
            <tr><td>${name}</td><td style="text-align: right;">${stats.qty}</td><td style="text-align: right;">Rp ${stats.revenue.toLocaleString('id-ID')}</td></tr>
        `).join('');
    }
    
    if (window.enableTableSort) window.enableTableSort('dashboard-method-table');
    if (window.enableTableSort) window.enableTableSort('dashboard-product-table');
}
