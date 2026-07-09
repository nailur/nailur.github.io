const fs = require('fs');
let html = fs.readFileSync('pos/index.html', 'utf8');
html = html.replace('id="op-user-info" class="user-badge hide-mobile"', 'id="op-user-info" class="user-badge hide-mobile hidden"');
html = html.replace('id="sa-user-info" class="user-badge hide-mobile"', 'id="sa-user-info" class="user-badge hide-mobile hidden"');
fs.writeFileSync('pos/index.html', html);
console.log('Hidden user badges');
