const fs = require('fs');
let html = fs.readFileSync('pos/index.html', 'utf8');

// ========== STEP 1: Remove the orphaned expenses-tab-content from POS view ==========
// It's stuck between history-tab-content and attendance-tab-content in the POS section
const expensesOrphan = html.match(/<div id="expenses-tab-content" class="pos-tab-pane[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\n\s*\n\s*<div id="attendance-tab-content"/);
if (expensesOrphan) {
    // Extract just the expenses div
    const start = html.indexOf('<div id="expenses-tab-content" class="pos-tab-pane');
    const searchAfter = html.indexOf('</div>', html.indexOf('</table>', start) + 6); // after table close
    const endOfExpensesDiv = html.indexOf('</div>', searchAfter + 6) + '</div>'.length;
    
    // Find the exact content to remove (between history end and attendance start)
    const historyEnd = html.indexOf('</div>', html.indexOf('id="history-pagination"'));
    const afterHistoryEnd = html.indexOf('\n', historyEnd + '</div>'.length);
    
    const attendanceStart = html.indexOf('<div id="attendance-tab-content"');
    
    // Extract the expenses block
    const expensesBlock = html.substring(html.indexOf('<div id="expenses-tab-content"'), attendanceStart).trim();
    
    // Remove from old location
    html = html.replace(expensesBlock, '');
    
    console.log('Removed orphaned expenses-tab-content from POS view');
} else {
    console.log('No orphaned expenses-tab-content found, trying alternate');
    // Try simpler approach
    const idx = html.indexOf('<div id="expenses-tab-content"');
    if (idx > -1) {
        // Find the closing tags for this section
        let depth = 0;
        let i = idx;
        let foundEnd = -1;
        while (i < html.length) {
            if (html.substring(i, i+4) === '<div') depth++;
            if (html.substring(i, i+6) === '</div>') {
                depth--;
                if (depth === 0) {
                    foundEnd = i + 6;
                    break;
                }
            }
            i++;
        }
        if (foundEnd > -1) {
            const block = html.substring(idx, foundEnd);
            html = html.replace(block, '');
            console.log('Removed expenses-tab-content block');
        }
    }
}

// ========== STEP 2: Create the three tab panes for management section ==========
const stockTabPane = `
                <!-- MANAJEMEN STOK TAB -->
                <div id="stock-tab-content" class="tab-pane hidden" style="padding: 10px;">
                    <div class="action-bar" style="flex-wrap: wrap; gap: 10px;">
                        <h3>Manajemen Stok (Inventaris)</h3>
                        <div class="filter-group">
                            <button class="btn btn-primary" id="btn-add-inventory">
                                <i class="ph ph-plus"></i> Tambah / Update Stok
                            </button>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table" id="inventory-table">
                            <thead>
                                <tr>
                                    <th>Kode Barang</th>
                                    <th>Nama Barang</th>
                                    <th>Kategori</th>
                                    <th>Satuan Beli</th>
                                    <th>Satuan Pakai</th>
                                    <th>Konversi</th>
                                    <th>Sisa Stok (Pakai)</th>
                                    <th class="action-col">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Inventory rows injected here -->
                            </tbody>
                        </table>
                    </div>
                </div>`;

const expensesTabPane = `
                <!-- BIAYA OPERASIONAL TAB -->
                <div id="expenses-tab-content" class="tab-pane hidden" style="padding: 10px;">
                    <div class="action-bar" style="flex-wrap: wrap; gap: 10px;">
                        <h3>Biaya Operasional</h3>
                        <div class="filter-group">
                            <button class="btn btn-primary" id="btn-add-expense">
                                <i class="ph ph-plus"></i> Catat Pengeluaran
                            </button>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table" id="expenses-table">
                            <thead>
                                <tr>
                                    <th>No. Dokumen</th>
                                    <th>Tgl Biaya</th>
                                    <th>Total (Rp)</th>
                                    <th>Keterangan</th>
                                    <th>Kasir</th>
                                    <th class="action-col">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Expenses rows injected here -->
                            </tbody>
                        </table>
                    </div>
                </div>`;

const depositsTabPane = `
                <!-- SETORAN PENJUALAN TAB -->
                <div id="deposits-tab-content" class="tab-pane hidden" style="padding: 10px;">
                    <div class="action-bar" style="flex-wrap: wrap; gap: 10px;">
                        <h3>Setoran Penjualan</h3>
                        <div class="filter-group">
                            <button class="btn btn-primary" id="btn-add-deposit">
                                <i class="ph ph-plus"></i> Input Setoran
                            </button>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table" id="deposits-table">
                            <thead>
                                <tr>
                                    <th>ID Setoran</th>
                                    <th>Tanggal</th>
                                    <th>Jumlah (Rp)</th>
                                    <th>Tipe Setoran</th>
                                    <th>Keterangan</th>
                                    <th>Kasir</th>
                                    <th class="action-col">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Deposits rows injected here -->
                            </tbody>
                        </table>
                    </div>
                </div>`;

// Insert before the ANALITIK TAB comment
const analytikMarker = '<!-- ANALITIK TAB -->';
const analytikIdx = html.indexOf(analytikMarker);
if (analytikIdx > -1) {
    html = html.substring(0, analytikIdx) + stockTabPane + '\n' + expensesTabPane + '\n' + depositsTabPane + '\n\n                    ' + html.substring(analytikIdx);
    console.log('Inserted stock, expenses, deposits tab panes into management section');
} else {
    console.log('ERROR: Could not find ANALITIK TAB marker');
}

// ========== STEP 3: Also fix the classList null error in modal close ==========
// Line 523: document.getElementById(modalId).classList.add('hidden');
html = html.replace(
    /document\.getElementById\(modalId\)\.classList\.add\('hidden'\)/g,
    "document.getElementById(modalId)?.classList.add('hidden')"
);

fs.writeFileSync('pos/index.html', html);
console.log('Done! HTML file updated.');
