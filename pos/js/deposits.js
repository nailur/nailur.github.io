import { supabase } from './supabase.js';
import { getActiveOutletId } from './state.js';
import { showToast, getLocalToday, generateRandomDocNumber } from './app.js';
import { getCurrentProfile } from './auth.js';

let depositsList = [];

export async function loadDeposits() {
    if (!getActiveOutletId()) return;
    const { data, error } = await supabase
        .from('sales_deposits')
        .select('*, profiles:created_by (name)')
        .eq('outlet_id', getActiveOutletId())
        .order('created_at', { ascending: false })
        .limit(100);
        
    if (!error) {
        depositsList = data || [];
        renderDeposits();
    }
}

export function renderDeposits() {
    const tbody = document.getElementById('deposits-table')?.querySelector('tbody');
    if (!tbody) return;
    
    if (depositsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Belum ada data setoran</td></tr>';
        return;
    }
    
    const role = window._managementRole || window.getCurrentProfile()?.role;
    const canDelete = ['superadmin', 'owner', 'kepala_cabang'].includes(role);
    
    tbody.innerHTML = depositsList.map(dep => `
        <tr>
            <td>${dep.document_number}</td>
            <td>${new Date(dep.deposit_date).toLocaleDateString('id-ID')}</td>
            <td>Rp ${dep.amount.toLocaleString('id-ID')}</td>
            <td>${dep.account_type || '-'}</td>
            <td>${dep.notes || '-'}</td>
            <td>${dep.profiles?.name || '-'}</td>
            <td>
                ${canDelete ? `<button class="btn btn-icon btn-danger" onclick="window.deleteDeposit('${dep.id}')" title="Hapus"><i class="ph ph-trash"></i></button>` : ''}
            </td>
        </tr>
    `).join('');
}

export async function handleSaveDeposit(e) {
    e.preventDefault();
    if (!getActiveOutletId()) return showToast('Pilih outlet', 'error');
    
    const btn = document.getElementById('form-deposit').querySelector('button[type="submit"]');
    btn.disabled = true;
    
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const account_type = document.getElementById('deposit-type').value;
    const notes = document.getElementById('deposit-notes').value;
    const docNumber = generateRandomDocNumber('ST'); // Setoran
    
    const payload = {
        outlet_id: getActiveOutletId(),
        document_number: docNumber,
        deposit_date: getLocalToday(),
        amount,
        account_type,
        notes,
        created_by: getCurrentProfile().id,
        status: 'Diposting'
    };
    
    try {
        const { error } = await supabase.from('sales_deposits').insert([payload]);
        if (error) throw error;
        
        showToast('Setoran berhasil dicatat', 'success');
        document.getElementById('modal-deposit').classList.add('hidden');
        loadDeposits();
    } catch (err) {
        showToast('Gagal mencatat setoran: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

export async function deleteDeposit(id) {
    if (!confirm('Hapus pencatatan setoran ini?')) return;
    const { error } = await supabase.from('sales_deposits').delete().eq('id', id);
    if (!error) {
        showToast('Berhasil dihapus', 'success');
        loadDeposits();
    }
}

window.deleteDeposit = deleteDeposit;
