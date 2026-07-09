import { supabase } from './supabase.js';
import { getActiveOutletId } from './state.js';
import { showToast, getLocalToday, generateRandomDocNumber } from './app.js';
import { getActiveShiftSession } from './shift.js';
import { getCurrentProfile } from './auth.js';

let expensesList = [];
let expenseItemsMaster = [];

export async function loadExpenseMaster() {
    if (!getActiveOutletId()) return;
    const { data } = await supabase.from('expense_items').select('*').eq('outlet_id', getActiveOutletId()).order('name');
    expenseItemsMaster = data || [];
    renderExpenseMasterTable();
    populateExpenseSelect();
}

export async function loadExpenses() {
    if (!getActiveOutletId()) return;
    const { data, error } = await supabase
        .from('operational_costs')
        .select('*, profiles:created_by (name)')
        .eq('outlet_id', getActiveOutletId())
        .order('created_at', { ascending: false })
        .limit(100);
        
    if (!error) {
        expensesList = data || [];
        renderExpenses();
    }
}

export function populateExpenseSelect() {
    const select = document.getElementById('expense-item-select');
    if (!select) return;
    if (expenseItemsMaster.length === 0) {
        select.innerHTML = '<option value="">Belum ada kategori biaya</option>';
    } else {
        select.innerHTML = expenseItemsMaster.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
    }
}

export function renderExpenses() {
    const tbody = document.getElementById('expenses-table')?.querySelector('tbody');
    if (!tbody) return;
    
    if (expensesList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada pengeluaran dicatat</td></tr>';
        return;
    }
    
    const role = window._managementRole;
    const canDelete = ['superadmin', 'owner', 'kepala_cabang'].includes(role);
    
    tbody.innerHTML = expensesList.map(exp => `
        <tr>
            <td>${exp.document_number}</td>
            <td>${new Date(exp.cost_date).toLocaleDateString('id-ID')}</td>
            <td>Rp ${exp.total_amount.toLocaleString('id-ID')}</td>
            <td>${exp.notes || '-'}</td>
            <td>${exp.profiles?.name || '-'}</td>
            <td>
                ${canDelete ? `<button class="btn btn-icon btn-danger" onclick="window.deleteExpense('${exp.id}')"><i class="ph ph-trash"></i></button>` : ''}
            </td>
        </tr>
    `).join('');
}

export function renderExpenseMasterTable() {
    const tbody = document.getElementById('expenses-master-table')?.querySelector('tbody');
    if (!tbody) return;
    
    if (expenseItemsMaster.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Belum ada data master biaya</td></tr>';
        return;
    }
    
    tbody.innerHTML = expenseItemsMaster.map(item => `
        <tr>
            <td>${item.name}</td>
            <td>${item.category || '-'}</td>
            <td>
                <button class="btn btn-icon btn-secondary" onclick="window.editExpenseMaster('${item.id}')" title="Edit"><i class="ph ph-pencil"></i></button>
                <button class="btn btn-icon btn-danger" onclick="window.deleteExpenseMaster('${item.id}')" title="Hapus"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

export async function handleSaveExpenseMaster(e) {
    e.preventDefault();
    const id = document.getElementById('expense-master-id').value;
    const name = document.getElementById('expense-master-name').value;
    const category = document.getElementById('expense-master-category').value;
    
    const payload = { outlet_id: getActiveOutletId(), name, category };
    
    let submitError;
    const btn = document.getElementById('form-expense-master').querySelector('button[type="submit"]');
    btn.disabled = true;
    
    if (id) {
        const { error: err } = await supabase.from('expense_items').update(payload).eq('id', id);
        submitError = err;
    } else {
        const { error: err } = await supabase.from('expense_items').insert([payload]);
        submitError = err;
    }
    
    btn.disabled = false;
    
    if (submitError) {
        showToast('Gagal menyimpan kategori biaya', 'error');
    } else {
        showToast('Kategori biaya berhasil disimpan', 'success');
        document.getElementById('modal-expense-master').classList.add('hidden');
        loadExpenseMaster();
    }
}

export function editExpenseMaster(id) {
    const item = expenseItemsMaster.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('expense-master-id').value = item.id;
    document.getElementById('expense-master-name').value = item.name;
    document.getElementById('expense-master-category').value = item.category || 'Bahan Tambahan';
    
    const modal = document.getElementById('modal-expense-master');
    const title = modal.querySelector('h2');
    if (title) title.textContent = 'Edit Kategori Biaya';
    
    modal.classList.remove('hidden');
}

export function openAddExpenseMaster() {
    const form = document.getElementById('form-expense-master');
    form.reset();
    document.getElementById('expense-master-id').value = '';
    
    const modal = document.getElementById('modal-expense-master');
    const title = modal.querySelector('h2');
    if (title) title.textContent = 'Tambah Kategori Biaya';
    
    modal.classList.remove('hidden');
}

export async function handleSaveExpense(e) {
    e.preventDefault();
    if (!getActiveOutletId()) return showToast('Pilih outlet', 'error');
    
    const profile = getCurrentProfile();
    let sessionId = null;
    if (profile.role !== 'superadmin' && profile.role !== 'owner') {
        const currentSession = getActiveShiftSession();
        if (!currentSession) return showToast('Anda belum membuka shift', 'error');
        sessionId = currentSession.id;
    }
    
    const btn = document.getElementById('form-expense').querySelector('button[type="submit"]');
    btn.disabled = true;
    
    const expenseItemId = document.getElementById('expense-item-select').value;
    const qty = parseFloat(document.getElementById('expense-qty').value);
    const total = parseFloat(document.getElementById('expense-total').value);
    const notes = document.getElementById('expense-notes').value;
    
    try {
        // Insert parent
        const docNumber = generateRandomDocNumber('B'); // B for Biaya
        const profileId = getCurrentProfile().id;
        
        const { data, error } = await supabase.from('operational_costs').insert([{
            outlet_id: getActiveOutletId(),
            shift_session_id: sessionId,
            document_number: docNumber,
            cost_date: getLocalToday(),
            total_amount: total,
            notes,
            created_by: profileId
        }]).select('id').single();
        
        if (error) throw error;
        
        // Insert items
        await supabase.from('operational_cost_items').insert([{
            operational_cost_id: data.id,
            expense_item_id: expenseItemId,
            quantity: qty,
            price: total / qty,
            subtotal: total
        }]);
        
        showToast('Pengeluaran berhasil dicatat', 'success');
        document.getElementById('modal-expense').classList.add('hidden');
        loadExpenses();
    } catch (err) {
        showToast('Gagal: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

export async function deleteExpense(id) {
    if (!confirm('Hapus pencatatan biaya ini?')) return;
    const { error } = await supabase.from('operational_costs').delete().eq('id', id);
    if (!error) {
        showToast('Berhasil dihapus', 'success');
        loadExpenses();
    }
}
export async function deleteExpenseMaster(id) {
    if (!confirm('Hapus master kategori biaya ini?')) return;
    const { error } = await supabase.from('expense_items').delete().eq('id', id);
    if (!error) {
        showToast('Berhasil dihapus', 'success');
        loadExpenseMaster();
    }
}

window.deleteExpense = deleteExpense;
window.deleteExpenseMaster = deleteExpenseMaster;
window.editExpenseMaster = editExpenseMaster;
