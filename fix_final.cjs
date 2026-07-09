const fs = require('fs');

// 1. Fix app.js
let appJs = fs.readFileSync('pos/js/app.js', 'utf8');
// Fix the management button logic that crashes
appJs = appJs.replace(
`    document.getElementById('btn-management').addEventListener('click', () => {
        showView('management');
        const role = getCurrentProfile()?.role;
        document.getElementById('sa-user-info').textContent = role.replace('_', ' ').replace(/\\b\\w/g, l => l.toUpperCase());
        initManagement();
    });
    document.getElementById('btn-back-pos').addEventListener('click', () => {
        showView('pos');
        // Pastikan tab kasir terbuka
        document.querySelector('.pos-nav-btn[data-target="pos-tab-content"]')?.click();
    });`,
`    document.getElementById('btn-management').addEventListener('click', () => {
        showView('management');
        // Removed sa-user-info modification because it was removed in the new html
        initManagement();
    });`
);
fs.writeFileSync('pos/js/app.js', appJs);

// 2. Fix index.html
let html = fs.readFileSync('pos/index.html', 'utf8');
// Target the exact string for the attendance widget
const widgetStart = '<!-- Attendance Widget (Moved to Cart Header) -->';
const widgetEnd = '<div class="cart-header">';
const startIndex = html.indexOf(widgetStart);
const endIndex = html.indexOf(widgetEnd, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    // Remove the chunk between startIndex and endIndex
    html = html.substring(0, startIndex) + html.substring(endIndex);
    fs.writeFileSync('pos/index.html', html);
    console.log("Successfully removed attendance widget from index.html");
} else {
    console.log("Could not find attendance widget in index.html");
}
