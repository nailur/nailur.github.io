import { supabase } from './supabase.js';
import { activeOutletId } from './state.js';
import { showToast } from './utils.js';
import { getCurrentProfile } from './auth.js';
import { handleClockIn, handleClockOut, currentAttendanceRecord } from './attendance.js';

let currentShiftSession = null;

export function getActiveShiftSession() {
    return currentShiftSession;
}

export async function checkActiveShift() {
    try {
        const profile = getCurrentProfile();
        if (!profile || profile.role === 'superadmin') {
            // Superadmin does not need shift locking
            unlockPOS();
            return null;
        }

        const { data, error } = await supabase
            .from('shift_sessions')
            .select('*')
            .eq('outlet_id', activeOutletId)
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            currentShiftSession = data;
            unlockPOS();
            return data;
        } else {
            currentShiftSession = null;
            lockPOS();
            return null;
        }
    } catch (err) {
        console.error("Error check active shift:", err);
        return null;
    }
}


export function lockPOS() {
    document.getElementById('pos-lock-screen')?.classList.remove('hidden');
    document.getElementById('btn-close-shift')?.classList.add('hidden');
    // Disable product search and add-to-cart while POS is locked
}

export function unlockPOS() {
    document.getElementById('pos-lock-screen')?.classList.add('hidden');
    document.getElementById('btn-close-shift')?.classList.remove('hidden');
}

export async function handleOpenShift(e) {
    e.preventDefault();
    const startingCash = parseFloat(document.getElementById('input-starting-cash').value) || 0;
    const profile = getCurrentProfile();

    try {
        // Check if user already has an active open shift session
        const { data: existingSession, error: checkError } = await supabase
            .from('shift_sessions')
            .select('id, opened_at')
            .eq('outlet_id', activeOutletId)
            .eq('user_id', profile.id)
            .eq('status', 'open')
            .maybeSingle();

        if (checkError) throw checkError;

        if (existingSession) {
            const openedTime = new Date(existingSession.opened_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
            showToast(`Anda masih memiliki sesi shift yang aktif (dibuka sejak ${openedTime}). Tutup sesi tersebut terlebih dahulu.`, 'error');
            document.getElementById('modal-open-shift').classList.add('hidden');
            document.getElementById('form-open-shift').reset();
            return;
        }

        // Create new session
        // IMPORTANT: opened_at must be set explicitly from the client (UTC ISO string)
        // to avoid timezone mismatch with Supabase server default now() which may use +07 offset.
        const openedAt = new Date().toISOString();
        const { data, error } = await supabase
            .from('shift_sessions')
            .insert([{
                outlet_id: activeOutletId,
                user_id: profile.id,
                shift_id: profile.shift_id,
                status: 'open',
                starting_cash: startingCash,
                opened_at: openedAt
            }])
            .select()
            .single();

        if (error) throw error;

        currentShiftSession = data;
        
        // Auto clock in if no attendance record exists, or if the previous one is already completed (clock_out filled)
        if (!currentAttendanceRecord || currentAttendanceRecord.clock_out) {
            await handleClockIn();
        }

        showToast('Shift berhasil dimulai', 'success');
        document.getElementById('modal-open-shift').classList.add('hidden');
        document.getElementById('form-open-shift').reset();
        unlockPOS();

    } catch (error) {
        console.error('Error opening shift:', error);
        showToast('Gagal memulai shift: ' + error.message, 'error');
    }
}

export async function handleCloseShift(e) {
    e.preventDefault();
    if (!currentShiftSession) {
        document.getElementById('modal-close-shift').classList.add('hidden');
        return showToast('Anda tidak memiliki sesi shift aktif (atau login sebagai superadmin)', 'info');
    }
    if (!currentAttendanceRecord) {
        document.getElementById('modal-close-shift').classList.add('hidden');
        return showToast('Anda belum melakukan absen masuk. Tidak bisa menutup shift.', 'error');
    }

    const endingCash = parseFloat(document.getElementById('input-ending-cash').value) || 0;

    try {
        const profile = getCurrentProfile();
        
        const { error } = await supabase
            .from('shift_sessions')
            .update({
                status: 'closed',
                ending_cash: endingCash,
                closed_at: new Date().toISOString(),
                closed_by: profile ? profile.id : null
            })
            .eq('id', currentShiftSession.id);

        if (error) throw error;

        // Auto clock out (will replace existing clock_out if already clocked out)
        if (currentAttendanceRecord) {
            await handleClockOut(true);
        }

        showToast('Shift berhasil ditutup', 'success');
        document.getElementById('modal-close-shift').classList.add('hidden');
        document.getElementById('form-close-shift').reset();
        
        currentShiftSession = null;
        lockPOS();

        // Prompt user to add expenses if any
        document.getElementById('modal-expense').classList.remove('hidden');

    } catch (error) {
        console.error('Error closing shift:', error);
        showToast('Gagal menutup shift: ' + error.message, 'error');
    }
}
