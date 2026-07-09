const fs = require('fs');

const oldHtml = fs.readFileSync('posOld_index.html', 'utf8');
let html = fs.readFileSync('pos/index.html', 'utf8');

const sIdx = oldHtml.indexOf('<div id="analytics-tab" class="tab-pane hidden">');
const eIdx = oldHtml.indexOf('<!-- 4. INFO SERVER TAB -->', sIdx);
if (sIdx !== -1 && eIdx !== -1) {
    const analyticsContent = oldHtml.substring(sIdx, eIdx).trim();
    
    // Replace the fake analytics-tab in current html
    const currSIdx = html.indexOf('<div id="analytics-tab" class="tab-pane hidden">');
    // Find where my fake analytics tab ends. 
    // It ends with: <p>Fitur Analitik sedang dalam pengembangan.</p>\n                        </div>\n                    </div>
    const currEIdx = html.indexOf('</div>\n                    </div>', currSIdx);
    
    if (currSIdx !== -1 && currEIdx !== -1) {
        html = html.substring(0, currSIdx) + analyticsContent + html.substring(currEIdx + '</div>\n                    </div>'.length);
        fs.writeFileSync('pos/index.html', html);
        console.log("Restored analytics-tab");
    } else {
        console.log("Could not find fake analytics-tab in new html");
    }
} else {
    console.log("Could not extract analytics from old html");
}
