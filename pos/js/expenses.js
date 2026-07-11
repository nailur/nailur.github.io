import { supabase } from './supabase.js';
import { getActiveOutletId } from './state.js';
import { showToast, getLocalToday, generateRandomDocNumber, escapeHtml } from './app.js';
import { getActiveShiftSession } from './shift.js';
import { getCurrentProfile } from './auth.js';

let expenseItemsMaster = [];
let expensesList = [];
let expensesPage = 0;
const EXPENSES_PAGE_SIZE = 50;
let hasMoreExpenses = true;
window.expenseCurrentItems = [];

export async function loadExpenseMaster() {
    if (!getActiveOutletId()) return;
    const { data } = await supabase.from('expense_items').select('*').eq('outlet_id', getActiveOutletId()).order('name');
    expenseItemsMaster = data || [];
    renderExpenseMasterTable();
    populateExpenseSelect();
}

export async function loadExpenses(append = false) {
    if (!getActiveOutletId()) return;
    
    if (!append) {
        expensesPage = 0;
        hasMoreExpenses = true;
    }
    
    if (!hasMoreExpenses) return;
    
    const { data, error } = await supabase
        .from('operational_costs')
        .select('*, profiles:created_by (name)')
        .eq('outlet_id', getActiveOutletId())
        .order('created_at', { ascending: false })
        .range(expensesPage * EXPENSES_PAGE_SIZE, (expensesPage + 1) * EXPENSES_PAGE_SIZE - 1);
        
    if (!error) {
        if (data.length < EXPENSES_PAGE_SIZE) {
            hasMoreExpenses = false;
        }
        
        if (append) {
            expensesList = [...expensesList, ...(data || [])];
        } else {
            expensesList = data || [];
        }
        
        expensesPage++;
        renderExpenses();
    }
}

window.loadMoreExpenses = function() {
    loadExpenses(true);
};

export function populateExpenseSelect() {
    const select = document.getElementById('expense-item-select');
    if (!select) return;
    if (expenseItemsMaster.length === 0) {
        select.innerHTML = '<option value="">Belum ada kategori biaya</option>';
    } else {
        select.innerHTML = expenseItemsMaster.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
    }
}

export function renderExpenses() {
    const tbody = document.getElementById('expenses-table')?.querySelector('tbody');
    if (!tbody) return;
    
    if (expensesList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Belum ada pengeluaran dicatat</td></tr>';
        return;
    }
    
    const role = window._managementRole || window.getCurrentProfile()?.role;
    const canEdit = ['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'].includes(role);
    const canDelete = ['superadmin', 'owner', 'kepala_cabang'].includes(role);
    
    tbody.innerHTML = expensesList.map(exp => `
        <tr>
            <td>${escapeHtml(exp.document_number)}</td>
            <td>${new Date(exp.cost_date).toLocaleDateString('id-ID')}</td>
            <td>Rp ${exp.total_amount.toLocaleString('id-ID')}</td>
            <td>${escapeHtml(exp.notes || '-')}</td>
            <td>${escapeHtml(exp.profiles?.name || '-')}</td>
            <td>
                ${canEdit ? `<button class="btn btn-icon btn-secondary" onclick="window.editExpense('${exp.id}')" title="Edit"><i class="ph ph-pencil-simple"></i></button>` : ''}
                ${canDelete ? `<button class="btn btn-icon btn-danger" onclick="window.deleteExpense('${exp.id}')" title="Hapus"><i class="ph ph-trash"></i></button>` : ''}
            </td>
        </tr>
    `).join('');
    
    const loadMoreBtn = document.getElementById('expenses-load-more-container');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = hasMoreExpenses ? 'block' : 'none';
    }
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
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.category || '-')}</td>
            <td>
                <button class="btn btn-icon btn-secondary" onclick="window.editExpenseMaster('${item.id}')" title="Edit"><i class="ph ph-pencil-simple"></i></button>
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

window.renderExpenseItemsTable = function() {
    const tbody = document.getElementById('expense-items-table')?.querySelector('tbody');
    if (!tbody) return;
    
    if (!window.expenseCurrentItems || window.expenseCurrentItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 10px;">Belum ada item ditambahkan</td></tr>';
        document.getElementById('expense-total').value = '0';
        return;
    }
    
    let total = 0;
    tbody.innerHTML = window.expenseCurrentItems.map((item, index) => {
        total += item.subtotal;
        return `
            <tr>
                <td>${escapeHtml(item.category_name)}</td>
                <td>${item.qty}</td>
                <td style="text-align: right;">Rp ${item.subtotal.toLocaleString('id-ID')}</td>
                <td style="text-align: center;">
                    <button type="button" class="btn btn-icon btn-danger" onclick="window.removeExpenseItem(${index})" title="Hapus"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('expense-total').value = total;
}

window.addExpenseItem = function() {
    const select = document.getElementById('expense-item-select');
    const qtyInput = document.getElementById('expense-qty');
    const priceInput = document.getElementById('expense-item-price');
    
    const expenseItemId = select.value;
    const categoryName = select.options[select.selectedIndex]?.text;
    const qty = parseFloat(qtyInput.value) || 1;
    const price = parseFloat(priceInput.value) || 0;
    
    if (!expenseItemId) return showToast('Pilih kategori biaya terlebih dahulu', 'error');
    if (price <= 0) return showToast('Nominal harus lebih dari 0', 'error');
    
    if(!window.expenseCurrentItems) window.expenseCurrentItems = [];
    window.expenseCurrentItems.push({
        expense_item_id: expenseItemId,
        category_name: categoryName,
        qty: qty,
        price: price,
        subtotal: qty * price
    });
    
    qtyInput.value = 1;
    priceInput.value = '';
    
    window.renderExpenseItemsTable();
}

window.removeExpenseItem = function(index) {
    if(window.expenseCurrentItems) {
        window.expenseCurrentItems.splice(index, 1);
        window.renderExpenseItemsTable();
    }
}

export async function editExpense(id) {
    const exp = expensesList.find(e => e.id === id);
    if (!exp) return;
    
    const form = document.getElementById('form-expense');
    if(form) form.reset();
    window.expenseCurrentItems = [];
    
    document.getElementById('expense-id').value = exp.id;
    document.getElementById('expense-notes').value = exp.notes || '';
    
    const modal = document.getElementById('modal-expense');
    const title = modal.querySelector('h2');
    if (title) title.textContent = 'Edit Pengeluaran';
    
    modal.classList.remove('hidden');
    
    // Fetch items
    const { data, error } = await supabase.from('operational_cost_items')
        .select('*, expense_items(name)')
        .eq('operational_cost_id', id);
        
    if (data && !error) {
        window.expenseCurrentItems = data.map(item => ({
            id: item.id,
            expense_item_id: item.expense_item_id,
            category_name: item.expense_items?.name || 'Item',
            qty: item.quantity,
            price: item.price,
            subtotal: item.subtotal
        }));
    }
    window.renderExpenseItemsTable();
}
window.editExpense = editExpense;

export async function handleSaveExpense(e) {
    e.preventDefault();
    if (!getActiveOutletId()) return showToast('Pilih outlet', 'error');
    
    if (!window.expenseCurrentItems || window.expenseCurrentItems.length === 0) {
        return showToast('Tambahkan minimal 1 item pengeluaran', 'error');
    }
    
    const profile = getCurrentProfile();
    let sessionId = null;
    if (profile.role !== 'superadmin' && profile.role !== 'owner') {
        const currentSession = getActiveShiftSession();
        if (!currentSession) return showToast('Anda belum membuka shift', 'error');
        sessionId = currentSession.id;
    }
    
    const btn = document.getElementById('form-expense').querySelector('button[type="submit"]');
    btn.disabled = true;
    
    const expenseId = document.getElementById('expense-id').value;
    const total = parseFloat(document.getElementById('expense-total').value);
    const notes = document.getElementById('expense-notes').value;
    
    try {
        if (expenseId) {
            const { error: err1 } = await supabase.from('operational_costs').update({
                total_amount: total,
                notes: notes
            }).eq('id', expenseId);
            if (err1) throw err1;
            
            await supabase.from('operational_cost_items').delete().eq('operational_cost_id', expenseId);
            
            const itemsToInsert = window.expenseCurrentItems.map(item => ({
                operational_cost_id: expenseId,
                expense_item_id: item.expense_item_id,
                quantity: item.qty,
                price: item.price,
                subtotal: item.subtotal
            }));
            
            await supabase.from('operational_cost_items').insert(itemsToInsert);
            showToast('Pengeluaran berhasil diperbarui', 'success');
        } else {
            const docNumber = generateRandomDocNumber('B');
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
            
            const itemsToInsert = window.expenseCurrentItems.map(item => ({
                operational_cost_id: data.id,
                expense_item_id: item.expense_item_id,
                quantity: item.qty,
                price: item.price,
                subtotal: item.subtotal
            }));
            
            await supabase.from('operational_cost_items').insert(itemsToInsert);
            showToast('Pengeluaran berhasil dicatat', 'success');
        }
        
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
