const fs = require('fs');
const cheerio = require('cheerio');

let html = fs.readFileSync('pos/index.html', 'utf8');
const $ = cheerio.load(html, { recognizeSelfClosing: true, decodeEntities: false });

// 1. Rename management-title
$('#management-title').text('Pengaturan');

// 2. Clone superadmin-view
const saView = $('#superadmin-view');
const opView = saView.clone();

// 3. Update IDs in opView
opView.attr('id', 'operations-view');
opView.find('#btn-sa-mobile-menu').attr('id', 'btn-op-mobile-menu');
opView.find('#sa-sidebar-overlay').attr('id', 'op-sidebar-overlay');
opView.find('#sa-sidebar').attr('id', 'op-sidebar');
opView.find('#sa-tabs-container').attr('id', 'op-tabs-container');
opView.find('#btn-back-pos').attr('id', 'btn-back-pos-op');
opView.find('#btn-user-menu-sa').attr('id', 'btn-user-menu-op');
opView.find('#user-dropdown-sa').attr('id', 'user-dropdown-op');
opView.find('#mgmt-active-outlet-selector').attr('id', 'op-active-outlet-selector');
opView.find('#sa-user-info').attr('id', 'op-user-info');
opView.find('#management-title').attr('id', 'operations-title').text('Manajemen');

// Desktop and Mobile titles
opView.find('.nav-brand span').each((i, el) => {
    if ($(el).text().includes('Pengaturan') || $(el).text().includes('Manajemen Sistem')) {
        $(el).text('Manajemen');
    }
});

// Update edit profile button ID if it exists
opView.find('#btn-edit-profile-sa').attr('id', 'btn-edit-profile-op');
opView.find('#btn-logout-sa').attr('id', 'btn-logout-op');

// 4. Remove unwanted tabs from opView
const opTabsToRemove = ['branches-tab', 'outlets-tab', 'users-tab', 'analytics-tab', 'server-info-tab', 'announcement-tab', 'expenses-master-tab'];
opTabsToRemove.forEach(tabId => {
    opView.find(`button[data-target="${tabId}"]`).remove();
    opView.find(`#${tabId}`).remove();
});

// Set shifts-tab as active in opView
opView.find('button[data-target="shifts-tab"]').addClass('active');
opView.find('#shifts-tab').removeClass('hidden').addClass('active');

// 5. Remove unwanted tabs from saView
const saTabsToRemove = ['shifts-tab', 'stock-tab-content', 'expenses-tab-content', 'deposits-tab-content'];
saTabsToRemove.forEach(tabId => {
    saView.find(`button[data-target="${tabId}"]`).remove();
    saView.find(`#${tabId}`).remove();
});

// Set branches-tab as active in saView
saView.find('button[data-target="branches-tab"]').addClass('active');
saView.find('#branches-tab').removeClass('hidden').addClass('active');

// Insert opsView before saView
saView.before('\n<!-- Tampilan Manajemen (Operations) -->\n');
saView.before(opView);

// 6. Duplicate the management button in the sidebar (which is in pos-view)
const btnMgmt = $('#btn-management');
const btnOp = btnMgmt.clone();
btnOp.attr('id', 'btn-operations');
btnOp.attr('title', 'Manajemen');
btnOp.find('i').removeClass('ph-gear').addClass('ph-briefcase');
btnOp.find('span').text('Manajemen');

btnMgmt.attr('title', 'Pengaturan');
btnMgmt.find('span').text('Pengaturan');

btnMgmt.before(btnOp);

fs.writeFileSync('pos/index.html', $.html());
console.log('Successfully rebuilt index.html');
