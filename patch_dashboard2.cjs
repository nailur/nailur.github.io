const fs = require('fs');

let dashboardJs = fs.readFileSync('pos/js/dashboard.js', 'utf8');

// Replace chart initializations with safe checks
dashboardJs = dashboardJs.replace(
    /if \(window\.revenueChartInst\) window\.revenueChartInst\.destroy\(\);\s*window\.revenueChartInst = new Chart\(revCtx\.getContext\('2d'\), \{[\s\S]*?\}\);/m,
    `if (revCtx) {
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
    }`
);

dashboardJs = dashboardJs.replace(
    /if \(window\.productChartInst\) window\.productChartInst\.destroy\(\);\s*window\.productChartInst = new Chart\(prodCtx\.getContext\('2d'\), \{[\s\S]*?\}\);/m,
    `if (prodCtx) {
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
    }`
);

dashboardJs = dashboardJs.replace(
    /if \(window\.methodsChartInst\) window\.methodsChartInst\.destroy\(\);\s*window\.methodsChartInst = new Chart\(methodCtx\.getContext\('2d'\), \{[\s\S]*?\}\);/m,
    `if (methodCtx) {
        if (window.methodsChartInst) window.methodsChartInst.destroy();
        window.methodsChartInst = new Chart(methodCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: methodLabels,
                datasets: [{
                    label: 'Transaksi',
                    data: methodData,
                    backgroundColor: '#10b981'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }`
);

// Safe dash-total assignments
dashboardJs = dashboardJs.replace(
    /document\.getElementById\('dash-total-revenue'\)\.textContent = `Rp \${totalRevenue\.toLocaleString\('id-ID'\)}`;/g,
    `if(document.getElementById('dash-total-revenue')) document.getElementById('dash-total-revenue').textContent = \`Rp \${totalRevenue.toLocaleString('id-ID')}\`;`
);
dashboardJs = dashboardJs.replace(
    /document\.getElementById\('dash-total-trx'\)\.textContent = totalTrx;/g,
    `if(document.getElementById('dash-total-trx')) document.getElementById('dash-total-trx').textContent = totalTrx;`
);
dashboardJs = dashboardJs.replace(
    /document\.getElementById\('dash-total-discount'\)\.textContent = `Rp \${totalDiscount\.toLocaleString\('id-ID'\)}`;/g,
    `if(document.getElementById('dash-total-discount')) document.getElementById('dash-total-discount').textContent = \`Rp \${totalDiscount.toLocaleString('id-ID')}\`;`
);

fs.writeFileSync('pos/js/dashboard.js', dashboardJs);
console.log("dashboard.js fully patched.");
