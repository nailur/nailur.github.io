const fs = require('fs');

let attendanceJs = fs.readFileSync('pos/js/attendance.js', 'utf8');

const loadHistoryLogic = `
export async function loadAttendanceHistory() {
    const profile = getCurrentProfile();
    if (!profile) return;
    
    // POS View: Today's history
    const today = new Date().toISOString().split('T')[0];
    const { data: todayData, error: todayError } = await supabase
        .from('attendance')
        .select('*, shifts(name)')
        .eq('profile_id', profile.id)
        .gte('clock_in', today)
        .order('clock_in', { ascending: false });
        
    const tbodyToday = document.querySelector('#attendance-tab-content tbody');
    if (tbodyToday) {
        if (!todayData || todayData.length === 0) {
            tbodyToday.innerHTML = '<tr><td colspan="4" style="text-align: center;">Belum ada data hari ini</td></tr>';
        } else {
            tbodyToday.innerHTML = todayData.map(a => \`
                <tr>
                    <td>\${new Date(a.clock_in).toLocaleDateString('id-ID')}</td>
                    <td>\${a.shifts?.name || '-'}</td>
                    <td>\${new Date(a.clock_in).toLocaleTimeString('id-ID')}</td>
                    <td>\${a.clock_out ? new Date(a.clock_out).toLocaleTimeString('id-ID') : '-'}</td>
                </tr>
            \`).join('');
        }
    }
    
    // Management View: All history
    const { data: allData, error: allError } = await supabase
        .from('attendance')
        .select('*, profiles(name), branches(name), shifts(name)')
        .eq('branch_id', profile.branch_id)
        .order('clock_in', { ascending: false })
        .limit(100);
        
    const tbodyAll = document.querySelector('#attendance-history-tab-content tbody');
    if (tbodyAll) {
        if (!allData || allData.length === 0) {
            tbodyAll.innerHTML = '<tr><td colspan="6" style="text-align: center;">Belum ada data</td></tr>';
        } else {
            tbodyAll.innerHTML = allData.map(a => {
                let status = '<span class="badge badge-success">Hadir</span>';
                if (!a.clock_out) status = '<span class="badge badge-warning">Aktif</span>';
                return \`
                <tr>
                    <td>\${new Date(a.clock_in).toLocaleDateString('id-ID')}</td>
                    <td>\${a.profiles?.name || '-'}</td>
                    <td>\${a.profiles?.role || '-'}</td>
                    <td>\${a.branches?.name || '-'}</td>
                    <td>\${new Date(a.clock_in).toLocaleTimeString('id-ID')}</td>
                    <td>\${a.clock_out ? new Date(a.clock_out).toLocaleTimeString('id-ID') : '-'}</td>
                </tr>
                \`;
            }).join('');
        }
    }
}
`;

// Add export function
attendanceJs += '\n' + loadHistoryLogic;

// Also need to call it inside checkAttendanceStatus()
attendanceJs = attendanceJs.replace(
    /renderAttendanceButton\(\);/g,
    'renderAttendanceButton();\n    loadAttendanceHistory();'
);

fs.writeFileSync('pos/js/attendance.js', attendanceJs);
console.log("attendance.js patched with loadAttendanceHistory.");
