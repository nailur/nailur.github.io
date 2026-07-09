const fs = require('fs');

let shiftJs = fs.readFileSync('pos/js/shift.js', 'utf8');

shiftJs = shiftJs.replace(
    /posContent\.style\.opacity = '0\.5';/g,
    `posContent.style.filter = 'blur(4px) grayscale(60%)';\n        posContent.style.transition = 'filter 0.3s ease';`
);

shiftJs = shiftJs.replace(
    /posContent\.style\.opacity = '1';/g,
    `posContent.style.filter = 'none';`
);

fs.writeFileSync('pos/js/shift.js', shiftJs);
console.log("shift.js patched for premium lock blur.");
