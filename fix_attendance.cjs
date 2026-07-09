const fs = require('fs');
let html = fs.readFileSync('pos/index.html', 'utf8');

// Fix literal \n
html = html.replace(/\\n/g, '\n');

// Inject the attendance tab if it doesn't exist
if (!html.includes('id="attendance-tab-content"')) {
    const dashboardTabStart = '<div id="dashboard-tab-content" class="pos-tab-pane hidden glass-panel history-panel">';
    const attendanceTabHTML = `
            <!-- NEW ABSENSI TAB -->
            <div id="attendance-tab-content" class="pos-tab-pane hidden glass-panel history-panel" style="padding: 20px;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <h2 style="font-size: 2rem;" id="attendance-time">00:00:00</h2>
                    <p style="color: var(--text-muted);" id="attendance-date">Senin, 1 Jan 2026</p>
                </div>
                
                <div class="glass-panel" style="padding: 20px; text-align: center; max-width: 400px; margin: 0 auto; border-radius: 12px; margin-bottom: 2rem; background: var(--bg-card);">
                    <div style="margin-bottom: 15px;">
                        <h3 id="attendance-name" style="margin: 0; font-size: 1.2rem;">Nama Kasir</h3>
                    </div>
                    <button id="btn-clock-time" class="btn btn-primary btn-block" style="padding: 15px; font-size: 1.1rem; border-radius: 50px;">
                        Clock In
                    </button>
                    <div style="margin-top: 15px; font-size: 0.9rem; color: var(--text-muted);" id="att-current-status">
                        Anda belum Clock-In hari ini.
                    </div>
                </div>

                <div class="table-responsive" style="flex: 1; max-width: 800px; margin: 0 auto;">
                    <h4 style="margin-bottom: 10px;">Riwayat Absensi (Hari Ini)</h4>
                    <table class="data-table" id="recent-attendance-table">
                        <thead><tr><th>Tgl</th><th>Shift</th><th>Clock-In</th><th>Clock-Out</th></tr></thead>
                        <tbody><tr><td colspan="4" style="text-align:center;">Belum ada data hari ini</td></tr></tbody>
                    </table>
                </div>
            </div>
    `;
    
    html = html.replace(dashboardTabStart, attendanceTabHTML + '\n\n            ' + dashboardTabStart);
}

fs.writeFileSync('pos/index.html', html);
console.log("Fixed attendance tab injection.");
