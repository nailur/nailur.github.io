const fs = require('fs');
const code = fs.readFileSync('pos/js/management.js', 'utf8');
let openParens = 0;
let backticks = 0;
let singleQuotes = 0;
let doubleQuotes = 0;
for (let i = 0; i < code.length; i++) {
    if (code[i] === '(') openParens++;
    if (code[i] === ')') openParens--;
    if (code[i] === '`') backticks++;
    if (code[i] === "'") singleQuotes++;
    if (code[i] === '"') doubleQuotes++;
}
console.log('Parens: ' + openParens);
console.log('Backticks: ' + backticks);
console.log('Single quotes: ' + singleQuotes);
console.log('Double quotes: ' + doubleQuotes);
