const fs = require('fs');

let html = fs.readFileSync('pos/index.html', 'utf8');

const analyticsStart = html.indexOf('<div id="analytics-tab" class="tab-pane hidden">');
const analyticsEnd = html.indexOf('</div>\n                    </div>', analyticsStart);

if (analyticsStart !== -1 && analyticsEnd !== -1) {
    const fakeAnalytics = `
                    <!-- ANALITIK TAB -->
                    <div id="analytics-tab" class="tab-pane hidden">
                        <div class="action-bar">
                            <h3>Analitik & Laporan</h3>
                        </div>
                        <div style="padding: 20px; text-align: center; color: var(--text-muted);">
                            <i class="ph-duotone ph-chart-line-up" style="font-size: 3rem; margin-bottom: 10px;"></i>
                            <p>Fitur Analitik sedang dalam pengembangan.</p>
                            <!-- Hidden elements to prevent dashboard.js from crashing -->
                            <div style="display:none;">
                                <span id="analytics-total-revenue"></span>
                                <span id="analytics-total-trx"></span>
                                <span id="analytics-total-items"></span>
                                <span id="analytics-total-discount"></span>
                                <span id="analytics-total-tax"></span>
                            </div>
`;
    html = html.substring(0, analyticsStart) + fakeAnalytics + html.substring(analyticsEnd);
    fs.writeFileSync('pos/index.html', html);
    console.log("Analytics tab patched to prevent JS crash.");
} else {
    console.log("Could not find fake analytics tab.");
}
