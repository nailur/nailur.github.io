const fs = require('fs');
let appJs = fs.readFileSync('pos/js/app.js', 'utf8');

// 1. Remove the crashing role check and btn-back-pos
appJs = appJs.replace(
/document\.getElementById\('btn-management'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?initManagement\(\);\s*\}\);[\s\S]*?document\.getElementById\('btn-back-pos'\)\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]*?\}\);/m,
`document.getElementById('btn-management').addEventListener('click', () => {
    showView('management');
    initManagement();
});`
);

fs.writeFileSync('pos/js/app.js', appJs);
console.log("Fixed app.js bugs");
