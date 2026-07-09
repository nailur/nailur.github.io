const fs = require('fs');
const code = fs.readFileSync('pos/js/management.js', 'utf8');
let openBraces = 0;
for (let i = 0; i < code.length; i++) {
    if (code[i] === '{') openBraces++;
    if (code[i] === '}') openBraces--;
}
console.log('Open braces: ' + openBraces);
