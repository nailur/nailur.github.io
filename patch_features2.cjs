const fs = require('fs');

let featuresJs = fs.readFileSync('pos/js/features.js', 'utf8');

const additionalListeners = `
    // Inventory Items
    const btnAddInventory = document.getElementById('btn-add-inventory-item');
    if (btnAddInventory) {
        btnAddInventory.addEventListener('click', () => {
            showToast('Form penambahan stok barang sedang dalam pengembangan.', 'info');
        });
    }

    // Operational Categories
    const btnAddOpCat = document.getElementById('btn-add-operational-cat');
    if (btnAddOpCat) {
        btnAddOpCat.addEventListener('click', () => {
            showToast('Sistem kategori saat ini menggunakan label manual.', 'info');
        });
    }
`;

featuresJs = featuresJs.replace(
    `export async function loadShifts() {`,
    additionalListeners + `\n\nexport async function loadShifts() {`
);

fs.writeFileSync('pos/js/features.js', featuresJs);
console.log("features.js patched with missing listeners.");
