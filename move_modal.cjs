const fs = require('fs');
let html = fs.readFileSync('pos/index.html', 'utf8');

// 1. Find and extract start-shift-modal
const startModalRegex = /<!-- START SHIFT MODAL -->[\s\S]*?<div id="start-shift-modal" class="modal-overlay hidden">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
const match = html.match(startModalRegex);

if (match) {
    const modalHtml = match[0];
    
    // Remove it from original position
    html = html.replace(startModalRegex, '');
    
    // Inject it into pos-tab-content
    // Ensure pos-tab-content has position: relative
    const posTabStart = '<div id="pos-tab-content" class="pos-tab-pane active pos-layout">';
    html = html.replace(posTabStart, posTabStart.replace('pos-layout"', 'pos-layout" style="position: relative;"') + '\n' + modalHtml.replace('class="modal-overlay hidden"', 'class="modal-overlay hidden" style="position: absolute;"'));
    
    fs.writeFileSync('pos/index.html', html);
    console.log("Moved start-shift-modal into pos-tab-content");
} else {
    console.log("Could not find start-shift-modal");
}
