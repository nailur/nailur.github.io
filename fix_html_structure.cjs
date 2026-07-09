const fs = require('fs');
let html = fs.readFileSync('pos/index.html', 'utf8');
let oldHtml = fs.readFileSync('posOld_index.html', 'utf8');

// 1. Fix start-shift-modal lock issue by adding pointer-events: auto
html = html.replace('id="start-shift-modal" class="modal-overlay hidden" style="position: absolute;"', 'id="start-shift-modal" class="modal-overlay hidden" style="position: absolute; pointer-events: auto;"');

// 2. Fix attendance-history-tab-content classes in Management View
html = html.replace('<div id="attendance-history-tab-content" class="pos-tab-pane hidden glass-panel history-panel">', '<div id="attendance-history-tab-content" class="tab-pane hidden" style="padding: 10px;">');

// 3. Add missing tabs for Setoran Penjualan (sales-deposits-tab) and Analitik (analytics-tab) in Management view if they don't exist
if (!html.includes('id="sales-deposits-tab"')) {
    const salesTab = `
                    <!-- SETORAN PENJUALAN TAB -->
                    <div id="sales-deposits-tab" class="tab-pane hidden">
                        <div class="action-bar">
                            <h3>Setoran Penjualan</h3>
                            <button class="btn btn-primary" id="btn-add-sales-deposit">
                                <i class="ph ph-plus"></i> Tambah Setoran
                            </button>
                        </div>
                        <div class="table-responsive">
                            <table class="data-table" id="sales-deposits-table">
                                <thead><tr><th>Tgl</th><th>Shift</th><th>Kasir</th><th>Jumlah</th><th>Status</th></tr></thead>
                                <tbody><tr><td colspan="5" style="text-align:center;">Belum ada data</td></tr></tbody>
                            </table>
                        </div>
                    </div>`;
    html = html.replace('<!-- RIWAYAT ABSENSI TAB (copied from posOld) -->', salesTab + '\n\n                    <!-- RIWAYAT ABSENSI TAB (copied from posOld) -->');
}

if (!html.includes('id="analytics-tab"')) {
    const analyticsTab = `
                    <!-- ANALITIK TAB -->
                    <div id="analytics-tab" class="tab-pane hidden">
                        <div class="action-bar">
                            <h3>Analitik & Laporan</h3>
                        </div>
                        <div style="padding: 20px; text-align: center; color: var(--text-muted);">
                            <i class="ph-duotone ph-chart-line-up" style="font-size: 3rem; margin-bottom: 10px;"></i>
                            <p>Fitur Analitik sedang dalam pengembangan.</p>
                        </div>
                    </div>`;
    html = html.replace('<!-- RIWAYAT ABSENSI TAB (copied from posOld) -->', analyticsTab + '\n\n                    <!-- RIWAYAT ABSENSI TAB (copied from posOld) -->');
}

// 4. Icons side-by-side
html = html.replace('id="btn-management" title="Manajemen Sistem"\n                        style="justify-content: flex-start;"', 'id="btn-management" title="Manajemen Sistem" style="justify-content: flex-start;"');
html = html.replace('id="btn-management" title="Manajemen Sistem"', 'id="btn-management" title="Manajemen Sistem"');
html = html.replace('<button class="btn btn-icon hidden" id="btn-management"', '<button class="btn btn-icon" id="btn-management"');
html = html.replace('<button class="btn btn-icon hidden" id="btn-edit-profile-pos"', '<button class="btn btn-icon" id="btn-edit-profile-pos"');

// 5. Restore server-info and announcement
const startS = oldHtml.indexOf('<div id="server-info-tab"');
const startA = oldHtml.indexOf('<div id="announcement-tab"', startS);
const endA = oldHtml.indexOf('</div>\n            </main>', startA);

if (startS !== -1 && startA !== -1 && endA !== -1) {
    const combinedTabs = oldHtml.substring(startS, endA);
    
    const currS = html.indexOf('<div id="server-info-tab"');
    const currEnd = html.indexOf('</div>\n            </main>\n        </section>\n\n\n        <!-- ======================= -->\n        <!-- 5. MANAJEMEN VIEW -->');
    if (currS !== -1 && currEnd !== -1) {
        html = html.substring(0, currS) + combinedTabs + '\n' + html.substring(currEnd);
        console.log("Restored server info and announcement");
    } else {
        console.log("Could not find insertion point in new html");
    }
}

fs.writeFileSync('pos/index.html', html);
console.log("Done");
