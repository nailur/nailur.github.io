const fs = require('fs');

let dashboardJs = fs.readFileSync('pos/js/dashboard.js', 'utf8');

// Replace the crashy DOM assignments with safe assignments
dashboardJs = dashboardJs.replace(
    /document\.getElementById\('analytics-total-revenue'\)\.textContent = `Rp \${totalRevenue\.toLocaleString\('id-ID'\)}`;/,
    `if(document.getElementById('analytics-total-revenue')) document.getElementById('analytics-total-revenue').textContent = \`Rp \${totalRevenue.toLocaleString('id-ID')}\`;`
);
dashboardJs = dashboardJs.replace(
    /document\.getElementById\('analytics-total-trx'\)\.textContent = \(Number\(result\.total_trx\) \|\| 0\)\.toLocaleString\('id-ID'\);/,
    `if(document.getElementById('analytics-total-trx')) document.getElementById('analytics-total-trx').textContent = (Number(result.total_trx) || 0).toLocaleString('id-ID');`
);
dashboardJs = dashboardJs.replace(
    /document\.getElementById\('analytics-total-items'\)\.textContent = totalItems\.toLocaleString\('id-ID'\);/,
    `if(document.getElementById('analytics-total-items')) document.getElementById('analytics-total-items').textContent = totalItems.toLocaleString('id-ID');`
);

fs.writeFileSync('pos/js/dashboard.js', dashboardJs);
console.log("dashboard.js patched.");
