const fs = require('fs');
const lines = fs.readFileSync('pos/js/management.js', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
    const bt = (lines[i].match(/`/g) || []).length;
    if (bt > 0) console.log('Line ' + (i+1) + ': ' + bt + ' backticks');
}
