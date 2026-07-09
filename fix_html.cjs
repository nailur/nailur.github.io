const fs = require('fs');
let html = fs.readFileSync('pos/index.html', 'utf8');

// 1. Remove Attendance Widget from Cart
const widgetRegex = /<!-- Attendance Widget \(Moved to Cart Header\) -->\s*<div id="attendance-widget"[\s\S]*?<\/div>\s*<\/div>\s*<div class="cart-header">/;
html = html.replace(widgetRegex, '<div class="cart-header">');

// 2. Remove old nav-attendance button from pos-tabs-container
const navRegex = /<button class="pos-nav-btn hidden" data-target="attendance-history-tab-content"\s*id="nav-attendance">Riwayat Absensi<\/button>/;
html = html.replace(navRegex, '');

fs.writeFileSync('pos/index.html', html);
console.log('Fixed index.html');
