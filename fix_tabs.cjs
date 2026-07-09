const fs = require('fs');

const oldHtml = fs.readFileSync('posOld_index.html', 'utf8');
let html = fs.readFileSync('pos/index.html', 'utf8');

const sIdx = oldHtml.indexOf('<div id="server-info-tab" class="tab-pane hidden">');
const eIdx = oldHtml.indexOf('<!-- ANNOUNCEMENT TAB -->', sIdx);
if (sIdx !== -1 && eIdx !== -1) {
    const serverInfoContent = oldHtml.substring(sIdx, eIdx).trim();
    
    const aIdx = oldHtml.indexOf('<div id="announcement-tab" class="tab-pane hidden" style="padding: 10px;">');
    const aEnd = oldHtml.indexOf('</div>\n            </main>', aIdx);
    if (aIdx !== -1 && aEnd !== -1) {
        let announcementContent = oldHtml.substring(aIdx, aEnd).trim();
        // Since there might be nested divs, aEnd might not be the exact end, but we match until </main> which is safe because announcement is the last tab.
        
        // We need to replace in pos/index.html
        // Currently pos/index.html has <div id="server-info-tab" class="tab-pane hidden">... and <div id="announcement-tab"... but they are corrupted
        const currSIdx = html.indexOf('<div id="server-info-tab"');
        const currAEnd = html.indexOf('</div>\n            </main>\n        </section>\n\n\n        <!-- ======================= -->\n        <!-- 5. MANAJEMEN VIEW -->');
        
        if (currSIdx !== -1 && currAEnd !== -1) {
            html = html.substring(0, currSIdx) + serverInfoContent + '\n\n' + announcementContent + '\n                </div>\n            </main>\n        </section>\n\n\n        <!-- ======================= -->\n        <!-- 5. MANAJEMEN VIEW -->' + html.substring(currAEnd + '</div>\n            </main>\n        </section>\n\n\n        <!-- ======================= -->\n        <!-- 5. MANAJEMEN VIEW -->'.length);
            fs.writeFileSync('pos/index.html', html);
            console.log("Replaced Server Info and Announcement tabs");
        } else {
            console.log("Could not find targets in pos/index.html");
        }
    } else {
        console.log("Could not extract announcement from old html");
    }
} else {
    console.log("Could not extract server info from old html");
}
