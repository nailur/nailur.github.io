const fs = require('fs');

let fJs = fs.readFileSync('pos/js/features.js', 'utf8');
fJs = fJs.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('pos/js/features.js', fJs);
console.log("features.js syntax fixed.");

let attJs = fs.readFileSync('pos/js/attendance.js', 'utf8');
attJs = attJs.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('pos/js/attendance.js', attJs);
console.log("attendance.js syntax fixed.");
