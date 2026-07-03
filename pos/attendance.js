import { supabase } from './supabase.js';
import { getCurrentProfile } from './auth.js';
import { getLocalToday, showToast, activeOutletId } from './app.js';

let attendanceTimer;
export let currentAttendanceRecord = null;

export function startAttendanceClock() {
    const profile = getCurrentProfile();
    const nameEl = document.getElementById('attendance-name');
    if(nameEl && profile) {
        let name = profile.name || profile.email.split('@')[0];
        nameEl.textContent = name;
    }

    if (attendanceTimer) clearInterval(attendanceTimer);
    attendanceTimer = setInterval(() => {
        const now = new Date();
        
        const timeEl = document.getElementById('attendance-time');
        if(timeEl) {
            timeEl.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
        }
        
        const dateEl = document.getElementById('attendance-date');
        if(dateEl) {
            dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
    }, 1000);
}

export async function checkAttendanceStatus() {
    const profile = getCurrentProfile();
    if (!profile || !activeOutletId) return;

    const today = getLocalToday();
    
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('outlet_id', activeOutletId)
        .eq('date', today)
        .single();

    currentAttendanceRecord = data;
    renderAttendanceButton();
}

export function renderAttendanceButton() {
    const btn = document.getElementById('btn-clock-time');
    if (!btn) return;

    if (!currentAttendanceRecord) {
        btn.textContent = 'Clock In';
        btn.className = 'btn btn-primary';
        btn.onclick = handleClockIn;
    } else if (!currentAttendanceRecord.clock_out) {
        const timeIn = new Date(currentAttendanceRecord.clock_in).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        btn.innerHTML = `<span style="display:flex; align-items:center; justify-content:center; gap:5px;"><div style="width:8px; height:8px; border-radius:50%; background:#10b981;"></div> Clock Out (In: ${timeIn})</span>`;
        btn.className = 'btn btn-secondary';
        btn.onclick = handleClockOut;
    } else {
        const timeOut = new Date(currentAttendanceRecord.clock_out).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        btn.innerHTML = `<span style="display:flex; align-items:center; justify-content:center; gap:5px;"><div style="width:8px; height:8px; border-radius:50%; background:#ef4444;"></div> Pulang: ${timeOut} (Klik Edit)</span>`;
        btn.className = 'btn btn-secondary';
        btn.onclick = handleClockOut; // Allow replacing clock out
    }
}

async function handleClockIn() {
    const profile = getCurrentProfile();
    if (!profile || !activeOutletId) return;

    const btn = document.getElementById('btn-clock-time');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const today = getLocalToday();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('attendance')
        .insert([{
            profile_id: profile.id,
            outlet_id: activeOutletId,
            date: today,
            clock_in: now
        }])
        .select()
        .single();

    btn.disabled = false;
    if (error) {
        showToast('Gagal Clock In: ' + error.message, 'error');
    } else {
        currentAttendanceRecord = data;
        showToast('Berhasil Clock In!', 'success');
        renderAttendanceButton();
    }
}

async function handleClockOut() {
    if (!currentAttendanceRecord) return;
    
    if (currentAttendanceRecord.clock_out) {
        if (!confirm('Anda sudah Clock Out sebelumnya. Ganti jam pulang dengan waktu sekarang?')) return;
    }

    const btn = document.getElementById('btn-clock-time');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('attendance')
        .update({ clock_out: now })
        .eq('id', currentAttendanceRecord.id)
        .select()
        .single();

    btn.disabled = false;
    if (error) {
        showToast('Gagal Clock Out: ' + error.message, 'error');
    } else {
        currentAttendanceRecord = data;
        showToast('Berhasil Clock Out!', 'success');
        renderAttendanceButton();
    }
}
