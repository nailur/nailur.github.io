import { supabase } from './supabase.js';
import { getCurrentProfile } from './auth.js';
import { getLocalToday, showToast, escapeHtml } from './app.js';
import { activeOutletId } from './state.js';
import { loadShiftSessions } from './shift-sessions.js';

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
        .select('*, shifts(name, start_time, end_time)')
        .eq('user_id', profile.id)
        .eq('outlet_id', activeOutletId)
        .gte('clock_in', startOfDay.toISOString())
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

    currentAttendanceRecord = data;

    // Populate User Info in the UI
    const nameEl = document.getElementById('att-user-name');
    const roleEl = document.getElementById('att-user-role');
    const initialsEl = document.getElementById('att-initials');
    if (nameEl) nameEl.textContent = profile.name || 'User';
    if (roleEl) roleEl.textContent = profile.role.replace('_', ' ').toUpperCase();
    if (initialsEl) initialsEl.textContent = (profile.name || 'U').substring(0, 1).toUpperCase();

    if (profile.shift_id) {
        const { data: shiftData } = await supabase.from('shifts').select('name, start_time, end_time').eq('id', profile.shift_id).single();
        if (shiftData) {
            document.getElementById('att-user-shift').textContent = shiftData.name;
            document.getElementById('att-shift-schedule').textContent = `${shiftData.start_time.slice(0,5)} - ${shiftData.end_time.slice(0,5)}`;
        } else {
            document.getElementById('att-user-shift').textContent = 'Shift tidak ditemukan';
            document.getElementById('att-shift-schedule').textContent = '-';
        }
    } else {
        document.getElementById('att-user-shift').textContent = 'Tanpa Shift / Default';
        document.getElementById('att-shift-schedule').textContent = '-';
    }

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
        if(statusText) statusText.textContent = 'Anda belum clock in hari ini.';
        document.getElementById('att-actual-in').textContent = '-';
        document.getElementById('att-actual-out').textContent = '-';
    } else if (!currentAttendanceRecord.clock_out) {
        btnIn.classList.add('hidden');
        btnOut.classList.remove('hidden');
        btnOut.onclick = handleClockOut;
        
        const inTime = new Date(currentAttendanceRecord.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        if(statusText) statusText.innerHTML = `Anda sudah masuk pada <strong style="color:var(--success)">${inTime}</strong>`;
        
        document.getElementById('att-actual-in').textContent = inTime;
        document.getElementById('att-actual-out').textContent = '-';
    } else {
        btnIn.classList.add('hidden');
        btnOut.classList.remove('hidden'); // allow edit
        btnOut.onclick = handleClockOut;
        
        const inTime = new Date(currentAttendanceRecord.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const outTime = new Date(currentAttendanceRecord.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        if(statusText) statusText.innerHTML = `Selesai! Jam Masuk: <strong style="color:var(--success)">${inTime}</strong>, Pulang: <strong style="color:var(--danger)">${outTime}</strong>.`;
        
        document.getElementById('att-actual-in').textContent = inTime;
        document.getElementById('att-actual-out').textContent = outTime;
    }
}

export async function handleClockIn() {
    const profile = getCurrentProfile();
    if (!profile || !activeOutletId) return;

    const btn = document.getElementById('btn-clock-in');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyimpan...';
    }

    const now = new Date().toISOString();

    let shiftName = 'Default Shift';
    if (profile.shift_id) {
        const { data: shiftData } = await supabase
            .from('shifts')
            .select('name')
            .eq('id', profile.shift_id)
            .single();
        if (shiftData) {
            shiftName = shiftData.name;
        }
    }

    const { data, error } = await supabase
        .from('attendances')
        .insert([{
            user_id: profile.id,
            outlet_id: activeOutletId,
            shift_id: profile.shift_id || null,
            shift_name_snapshot: shiftName,
            clock_in: now
        }])
        .select('id, clock_in, clock_out')
        .single();

    if (btn) btn.disabled = false;
    if (error) {
        showToast('Gagal Clock In: ' + error.message, 'error');
    } else {
        currentAttendanceRecord = data;
        showToast('Berhasil Clock In!', 'success');
        renderAttendanceButton();
        loadAttendanceHistory();
    }
}

export async function handleClockOut(force = false) {
    if (!currentAttendanceRecord) return;
    
    if (currentAttendanceRecord.clock_out && !force) {
        if (!confirm('Anda sudah Clock Out sebelumnya. Ganti jam pulang dengan waktu sekarang?')) return;
    }

    const btn = document.getElementById('btn-clock-out');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Menyimpan...';
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('attendances')
        .update({ clock_out: now })
        .eq('id', currentAttendanceRecord.id)
        .select('id, clock_in, clock_out')
        .single();

    if (btn) btn.disabled = false;
    if (error) {
        showToast('Gagal Clock Out: ' + error.message, 'error');
        if (btn) btn.innerHTML = '<i class="ph-bold ph-sign-out"></i> Clock Out';
    } else {
        currentAttendanceRecord = data;
        showToast('Berhasil Clock Out!', 'success');
        btn.innerHTML = '<i class="ph-bold ph-sign-out"></i> Clock Out';
        renderAttendanceButton();
        loadAttendanceHistory();
    }
}

export async function loadAttendanceHistory() {
    const profile = getCurrentProfile();
    if (!profile) return;
    
    const startInput = document.getElementById('attendance-start-date');
    const endInput = document.getElementById('attendance-end-date');
    
    if (startInput && !startInput.value) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        startInput.value = d.toISOString().split('T')[0];
    }
    if (endInput && !endInput.value) {
        endInput.value = getLocalToday();
    }
    
    let startDate = startInput?.value ? new Date(startInput.value) : new Date();
    startDate.setHours(0,0,0,0);
    
    let endDate = endInput?.value ? new Date(endInput.value) : new Date();
    endDate.setHours(23,59,59,999);
    
    let query = supabase
        .from('attendances')
        .select('*, profiles!inner(name, role, branch_id), shifts(name)')
        .gte('clock_in', startDate.toISOString())
        .lte('clock_in', endDate.toISOString())
        .order('clock_in', { ascending: false });

    // Role-based visibility
    if (profile.role === 'kasir') {
        query = query.eq('user_id', profile.id);
    } else if (profile.role === 'kepala_toko') {
        if (activeOutletId) {
            query = query.eq('outlet_id', activeOutletId);
        }
    } else if (profile.role === 'kepala_cabang') {
        if (profile.branch_id) {
            query = query.eq('profiles.branch_id', profile.branch_id);
        } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Force empty if no branch assigned
        }
    }
    // owner and superadmin can see all

    const { data, error } = await query;
        
    const tbody = document.getElementById('attendance-table')?.querySelector('tbody');
    if (!tbody) return;
    
    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Belum ada riwayat presensi</td></tr>';
        await loadShiftSessions();
        return;
    }
    
    tbody.innerHTML = data.map(record => {
        const dateStr = new Date(record.clock_in).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeIn = new Date(record.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const timeOut = record.clock_out ? new Date(record.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
        const shiftNameDisplay = record.shift_name_snapshot || record.shifts?.name || '-';
        
        const formatTitleCase = (str) => {
            if (!str) return '-';
            return str.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        };
        const roleName = formatTitleCase(record.profiles?.role);
        const shiftName = formatTitleCase(shiftNameDisplay);
        
        let statusBadge = '<span class="badge badge-secondary">Belum Pulang</span>';
        if (record.clock_out) statusBadge = '<span class="badge badge-success">Selesai</span>';
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${escapeHtml(record.profiles?.name || 'Kasir')}</td>
                <td>${escapeHtml(roleName)}</td>
                <td>${escapeHtml(shiftName)}</td>
                <td>${timeIn}</td>
                <td>${timeOut}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');

    // Load shift sessions after attendance is loaded
    await loadShiftSessions();
}
window.loadAttendanceHistory = loadAttendanceHistory;
