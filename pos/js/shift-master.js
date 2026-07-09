import { supabase } from './supabase.js';
import { activeOutletId } from './state.js';
import { showToast } from './app.js';

let shiftsList = [];

export async function loadShifts() {
    if (!activeOutletId) return;
    const { data, error } = await supabase.from('shifts').select('*').eq('outlet_id', activeOutletId);
    if (!error) {
        shiftsList = data || [];
        renderShifts();
    }
}

function renderShifts() {
    const tbody = document.getElementById('shifts-table')?.querySelector('tbody');
    if (!tbody) return;
    
    if (shiftsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada data shift</td></tr>';
        return;
    }
    
    tbody.innerHTML = shiftsList.map(s => `
        <tr>
            <td>${s.name}</td>
            <td>${s.start_time}</td>
            <td>${s.end_time}</td>
            <td>
                <button class="btn btn-icon btn-secondary" onclick="window.editShift('${s.id}')" title="Edit"><i class="ph ph-pencil"></i></button>
                <button class="btn btn-icon btn-danger" onclick="window.deleteShift('${s.id}')" title="Hapus"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

export function openShiftModal(id = null) {
    const form = document.getElementById('form-shift-master');
    const modal = document.getElementById('modal-shift-master');
    const title = document.getElementById('modal-shift-master-title') || modal.querySelector('h2');
    
    form.reset();
    document.getElementById('shift-master-id').value = '';
    
    if (id) {
        const shift = shiftsList.find(s => s.id === id);
        if (shift) {
            if(title) title.textContent = 'Edit Shift';
            document.getElementById('shift-master-id').value = shift.id;
            document.getElementById('shift-master-name').value = shift.name;
            document.getElementById('shift-master-start').value = shift.start_time;
            document.getElementById('shift-master-end').value = shift.end_time;
        }
    } else {
        if(title) title.textContent = 'Tambah Shift Baru';
    }
    modal.classList.remove('hidden');
}

export async function handleSaveShift(e) {
    e.preventDefault();
    if (!activeOutletId) return showToast('Pilih outlet terlebih dahulu', 'error');
    
    const id = document.getElementById('shift-master-id').value;
    const payload = {
        outlet_id: activeOutletId,
        name: document.getElementById('shift-master-name').value,
        start_time: document.getElementById('shift-master-start').value,
        end_time: document.getElementById('shift-master-end').value
    };
    
    const btn = document.getElementById('form-shift-master').querySelector('button[type="submit"]');
    btn.disabled = true;
    
    let error;
    if (id) {
        const { error: err } = await supabase.from('shifts').update(payload).eq('id', id);
        error = err;
    } else {
        const { error: err } = await supabase.from('shifts').insert([payload]);
        error = err;
    }
    
    btn.disabled = false;
    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('Shift berhasil disimpan', 'success');
        document.getElementById('modal-shift-master').classList.add('hidden');
        loadShifts();
    }
}

export async function deleteShift(id) {
    if (!confirm('Hapus shift ini?')) return;
    const { error } = await supabase.from('shifts').delete().eq('id', id);
    if (error) showToast(error.message, 'error');
    else loadShifts();
}

window.editShift = openShiftModal;
window.deleteShift = deleteShift;
