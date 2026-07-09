import { supabase } from './supabase.js';
import { getCurrentProfile } from './auth.js';
import { getLocalToday, showToast } from './app.js';
import { activeOutletId } from './state.js';

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

    // We check attendance by looking for the latest clock_in for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data } = await supabase
        .from('attendances')
        .select('id, clock_in, clock_out')
        .eq('user_id', profile.id)
        .eq('outlet_id', activeOutletId)
        .gte('clock_in', startOfDay.toISOString())
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

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

    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('attendances')
        .insert([{
            user_id: profile.id,
            outlet_id: activeOutletId,
            shift_id: profile.shift_id || null,
            clock_in: now
        }])
        .select('id, clock_in, clock_out')
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
        .from('attendances')
        .update({ clock_out: now })
        .eq('id', currentAttendanceRecord.id)
        .select('id, clock_in, clock_out')
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
