const fs = require('fs');
const cheerio = require('cheerio');

let html = fs.readFileSync('pos/index.html', 'utf8');

const $ = cheerio.load(html, { recognizeSelfClosing: true, decodeEntities: false });

// In operations-view, remove Pengaturan tabs
const opsView = $('#operations-view');
opsView.find('button[data-target="branches-tab"]').remove();
opsView.find('button[data-target="outlets-tab"]').remove();
opsView.find('button[data-target="users-tab"]').remove();
opsView.find('button[data-target="analytics-tab"]').remove();
opsView.find('button[data-target="server-info-tab"]').remove();
opsView.find('button[data-target="announcement-tab"]').remove();

opsView.find('#branches-tab').remove();
opsView.find('#outlets-tab').remove();
opsView.find('#users-tab').remove();
opsView.find('#analytics-tab').remove();
opsView.find('#server-info-tab').remove();
opsView.find('#announcement-tab').remove();

// In superadmin-view, remove Operations tabs
const saView = $('#superadmin-view');
saView.find('button[data-target="shifts-tab"]').remove();
saView.find('button[data-target="stock-tab-content"]').remove();
saView.find('button[data-target="expenses-tab-content"]').remove();
saView.find('button[data-target="deposits-tab-content"]').remove();
saView.find('button[data-target="expenses-master-tab"]').remove();

saView.find('#shifts-tab').remove();
saView.find('#stock-tab-content').remove();
saView.find('#expenses-tab-content').remove();
saView.find('#deposits-tab-content').remove();
// Wait, is expenses-master-tab operations or pengaturan?
// User said: "buat 1 menu baru aja untuk menu stok, biaya operasional, dan setoran"
// Expenses master is part of Biaya Operasional technically? But it's a separate tab.
// I'll leave expenses-master-tab in Pengaturan for now, or just leave it alone since my script didn't move it earlier.
// Wait, expenses-master-tab was loaded for KC/Owner/Superadmin.
// Let's remove it from operations view just in case.
opsView.find('button[data-target="expenses-master-tab"]').remove();
opsView.find('#expenses-master-tab').remove();

// Get the updated HTML for the two sections
const newOpsView = $.html(opsView);
const newSaView = $.html(saView);

// Since Cheerio formatting can mess up the rest of the document, we will manually replace the sections in the original string.
const opsStartIdx = html.indexOf('<section id="operations-view"');
let i = opsStartIdx;
let d = 0, e = -1;
while(i < html.length) {
    if(html.substring(i, i+8) === '<section') d++;
    if(html.substring(i, i+9) === '</section') {
        d--;
        if(d===0) { e = i+10; break; }
    }
    i++;
}
html = html.substring(0, opsStartIdx) + newOpsView + html.substring(e);

const saStartIdx = html.indexOf('<section id="superadmin-view"');
i = saStartIdx;
d = 0; e = -1;
while(i < html.length) {
    if(html.substring(i, i+8) === '<section') d++;
    if(html.substring(i, i+9) === '</section') {
        d--;
        if(d===0) { e = i+10; break; }
    }
    i++;
}
html = html.substring(0, saStartIdx) + newSaView + html.substring(e);

fs.writeFileSync('pos/index.html', html);
console.log('Cleaned up tabs in both views.');
