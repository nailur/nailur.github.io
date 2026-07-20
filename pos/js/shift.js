import { supabase } from './supabase.js';
import { activeOutletId } from './state.js';
import { showToast } from './app.js';
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
            // Superadmin tak perlu lock shift
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
    // Matikan pencarian produk atau fungsi add to cart
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
        // Create new session
        const { data, error } = await supabase
            .from('shift_sessions')
            .insert([{
                outlet_id: activeOutletId,
                user_id: profile.id,
                shift_id: profile.shift_id,
                status: 'open',
                starting_cash: startingCash
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
