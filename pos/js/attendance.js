import { supabase } from './supabase.js';
import { getCurrentProfile } from './auth.js';
import { getLocalToday, showToast } from './app.js';
import { activeOutletId } from './state.js';

let attendanceTimer;
export let currentAttendanceRecord = null;

export function startAttendanceClock() {
    if (attendanceTimer) clearInterval(attendanceTimer);
    attendanceTimer = setInterval(() => {
        const now = new Date();
        
        const timeEl = document.getElementById('attendance-live-time');
        if(timeEl) {
            timeEl.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
        }
        
        const dateEl = document.getElementById('attendance-live-date');
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
    loadAttendanceHistory();
}

export function renderAttendanceButton() {
    const btnIn = document.getElementById('btn-clock-in');
    const btnOut = document.getElementById('btn-clock-out');
    const statusText = document.getElementById('attendance-status-text');
    if (!btnIn || !btnOut) return;

    if (!currentAttendanceRecord) {
        btnIn.classList.remove('hidden');
        btnOut.classList.add('hidden');
        btnIn.onclick = handleClockIn;
        if(statusText) statusText.textContent = '';
    } else if (!currentAttendanceRecord.clock_out) {
        btnIn.classList.add('hidden');
        btnOut.classList.remove('hidden');
        btnOut.onclick = handleClockOut;
        
        const timeIn = new Date(currentAttendanceRecord.clock_in).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        if(statusText) statusText.textContent = `Anda sudah masuk (Clock In) pada ${timeIn}`;
    } else {
        btnIn.classList.add('hidden');
        btnOut.classList.remove('hidden');
        btnOut.onclick = handleClockOut; // Allow re-clock out
        
        const timeOut = new Date(currentAttendanceRecord.clock_out).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        if(statusText) statusText.textContent = `Anda sudah pulang pada ${timeOut}. (Klik Clock Out lagi jika ingin revisi)`;
    }
}

async function handleClockIn() {
    const profile = getCurrentProfile();
    if (!profile || !activeOutletId) return;

    const btn = document.getElementById('btn-clock-in');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyimpan...';

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

    const btn = document.getElementById('btn-clock-out');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyimpan...';

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
        loadAttendanceHistory();
    }
}

export async function loadAttendanceHistory() {
    const profile = getCurrentProfile();
    if (!profile || !activeOutletId) return;
    
    // 3 Hari Terakhir
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    
    const { data, error } = await supabase
        .from('attendances')
        .select('*, profiles(name, role), shifts(name)')
        .eq('outlet_id', activeOutletId)
        .eq('user_id', profile.id)
        .gte('clock_in', pastDate.toISOString())
        .order('clock_in', { ascending: false });
        
    const tbody = document.getElementById('attendance-table')?.querySelector('tbody');
    if (!tbody) return;
    
    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Belum ada riwayat presensi</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(record => {
        const dateStr = new Date(record.clock_in).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeIn = new Date(record.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const timeOut = record.clock_out ? new Date(record.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        const roleShift = (record.profiles?.role || '') + (record.shifts ? ` / ${record.shifts.name}` : '');
        
        let statusBadge = '<span class="badge badge-secondary">Belum Pulang</span>';
        if (record.clock_out) statusBadge = '<span class="badge badge-success">Selesai</span>';
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${record.profiles?.name || 'Kasir'}</td>
                <td>${roleShift}</td>
                <td>${timeIn}</td>
                <td>${timeOut}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');
}
