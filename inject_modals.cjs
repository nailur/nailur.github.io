const fs = require('fs');

let html = fs.readFileSync('pos/index.html', 'utf8');

const modals = `
    <!-- ADD SHIFT MODAL -->
    <div id="modal-add-shift" class="modal-overlay hidden" style="align-items: center; justify-content: center; z-index: 2000;">
        <div class="modal glass-panel" style="width: 100%; max-width: 400px; padding: 25px;">
            <div class="modal-header">
                <h2>Tambah Shift</h2>
                <button class="btn btn-icon btn-close-modal"><i class="ph ph-x"></i></button>
            </div>
            <form id="form-add-shift" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                <div class="form-group">
                    <label>Nama Shift</label>
                    <input type="text" id="shift-name" required placeholder="Contoh: Shift Pagi" class="form-control">
                </div>
                <div class="form-group" style="display: flex; gap: 10px;">
                    <div style="flex: 1;">
                        <label>Jam Mulai</label>
                        <input type="time" id="shift-start" required class="form-control">
                    </div>
                    <div style="flex: 1;">
                        <label>Jam Selesai</label>
                        <input type="time" id="shift-end" required class="form-control">
                    </div>
                </div>
                <button type="submit" class="btn btn-primary" style="margin-top: 10px;">Simpan Shift</button>
            </form>
        </div>
    </div>

    <!-- ADD SALES DEPOSIT MODAL -->
    <div id="modal-add-sales-deposit" class="modal-overlay hidden" style="align-items: center; justify-content: center; z-index: 2000;">
        <div class="modal glass-panel" style="width: 100%; max-width: 400px; padding: 25px;">
            <div class="modal-header">
                <h2>Tambah Setoran Penjualan</h2>
                <button class="btn btn-icon btn-close-modal"><i class="ph ph-x"></i></button>
            </div>
            <form id="form-add-sales-deposit" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                <div class="form-group">
                    <label>Jumlah Setoran (Rp)</label>
                    <input type="number" id="deposit-amount" required placeholder="Masukkan nominal" class="form-control">
                </div>
                <div class="form-group">
                    <label>Catatan (Opsional)</label>
                    <textarea id="deposit-notes" rows="3" placeholder="Catatan setoran..." class="form-control" style="resize: none;"></textarea>
                </div>
                <button type="submit" class="btn btn-primary" style="margin-top: 10px;">Simpan Setoran</button>
            </form>
        </div>
    </div>
`;

// Insert before the closing body tag or next to other modals
const insertIdx = html.indexOf('<!-- START SHIFT MODAL -->');
if (insertIdx !== -1) {
    html = html.substring(0, insertIdx) + modals + html.substring(insertIdx);
    fs.writeFileSync('pos/index.html', html);
    console.log("Modals added to index.html");
} else {
    console.log("Could not find insert position");
}
