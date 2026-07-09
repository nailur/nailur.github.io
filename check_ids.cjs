const fs = require('fs');
let html = fs.readFileSync('pos/index.html', 'utf8');

const opsViewStart = html.indexOf('<section id="operations-view"');
const opsViewEnd = html.indexOf('</section>', opsViewStart) + 10;
let opsView = html.substring(opsViewStart, opsViewEnd);

const ids = [];
const idRegex = /id="([^"]+)"/g;
let match;
while ((match = idRegex.exec(opsView)) !== null) {
    ids.push(match[1]);
}
console.log('Ops view IDs:', ids);
