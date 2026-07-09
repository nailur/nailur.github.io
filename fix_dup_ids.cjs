const fs = require('fs');
let html = fs.readFileSync('pos/index.html', 'utf8');

const opsViewStart = html.indexOf('<section id="operations-view"');
const opsViewEnd = html.indexOf('</section>', opsViewStart) + 10;
let opsView = html.substring(opsViewStart, opsViewEnd);

// Fix duplicated IDs in operations-view
opsView = opsView.replace('id="btn-back-pos"', 'id="btn-back-pos-op"');
opsView = opsView.replace('id="sa-user-info"', 'id="op-user-info"');

html = html.substring(0, opsViewStart) + opsView + html.substring(opsViewEnd);

fs.writeFileSync('pos/index.html', html);
console.log('Fixed duplicate IDs in index.html');
