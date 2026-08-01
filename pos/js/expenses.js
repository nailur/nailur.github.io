import { supabase } from './supabase.js';
import { getActiveOutletId } from './state.js';
import { showToast, getLocalToday, generateRandomDocNumber, escapeHtml } from './utils.js';
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
    
    tbody.innerHTML = expensesList.map(exp => {
        const method = exp.payment_method || 'Tunai';
        const methodBadge = method === 'Non-Tunai'
            ? `<span class="badge" style="background:var(--primary); color:white; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem;">Non-Tunai</span>`
            : `<span class="badge" style="background:var(--success); color:white; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem;">Tunai</span>`;
        return `
        <tr>
            <td>${escapeHtml(exp.document_number)}</td>
            <td>${new Date(exp.cost_date).toLocaleDateString('id-ID')}</td>
            <td>Rp ${exp.total_amount.toLocaleString('id-ID')}</td>
            <td>${methodBadge}</td>
            <td style="max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(exp.notes || '-')}">${escapeHtml(exp.notes || '-')}</td>
            <td>${escapeHtml(exp.profiles?.name || '-')}</td>
            <td>
                ${canEdit ? `<button class="btn btn-icon btn-secondary" onclick="window.editExpense('${exp.id}')" title="Edit"><i class="ph ph-pencil-simple"></i></button>` : ''}
                ${canDelete ? `<button class="btn btn-icon btn-danger" onclick="window.deleteExpense('${exp.id}')" title="Hapus"><i class="ph ph-trash"></i></button>` : ''}
            </td>
        </tr>
    `;
    }).join('');
    
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
    const methodSelect = document.getElementById('expense-payment-method');
    if (methodSelect) methodSelect.value = exp.payment_method || 'Tunai';
    
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
    const paymentMethod = document.getElementById('expense-payment-method')?.value || 'Tunai';
    
    try {
        if (expenseId) {
            const { error: err1 } = await supabase.from('operational_costs').update({
                total_amount: total,
                notes: notes,
                payment_method: paymentMethod
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
                payment_method: paymentMethod,
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

export async function exportExpensesToExcel() {
    if (!getActiveOutletId()) return showToast('Pilih outlet terlebih dahulu', 'error');

    // Lazy load SheetJS library if not yet loaded
    if (!window.XLSX) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = './assets/lib/xlsx.full.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        } catch (e) {
            return showToast('Gagal memuat library Excel', 'error');
        }
    }

    const btn = document.getElementById('btn-export-expenses-excel');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Mengekspor...';
    }

    try {
        const { data: costsData, error: costsError } = await supabase
            .from('operational_costs')
            .select('id, document_number, cost_date, total_amount, payment_method, notes, profiles:created_by (name)')
            .eq('outlet_id', getActiveOutletId())
            .order('cost_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (costsError) throw costsError;

        if (!costsData || costsData.length === 0) {
            showToast('Tidak ada data Biaya Operasional untuk diekspor', 'error');
            return;
        }

        const costIds = costsData.map(c => c.id);
        const { data: itemsData, error: itemsError } = await supabase
            .from('operational_cost_items')
            .select('operational_cost_id, quantity, price, subtotal, expense_items (name)')
            .in('operational_cost_id', costIds);

        if (itemsError) throw itemsError;

        const itemsByCostId = {};
        (itemsData || []).forEach(item => {
            if (!itemsByCostId[item.operational_cost_id]) {
                itemsByCostId[item.operational_cost_id] = [];
            }
            itemsByCostId[item.operational_cost_id].push(item);
        });

        // --- SHEET 1: Ringkasan Biaya Operasional ---
        const rowsSummary = [
            ['Laporan Ringkasan Biaya Operasional'],
            [`Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')}`],
            [],
            ['No. Dokumen', 'Tanggal Biaya', 'Total (Rp)', 'Metode Pembayaran', 'Rincian Item Pengeluaran', 'Keterangan / Catatan', 'Dicatat Oleh (Kasir)']
        ];

        let totalSum = 0;
        let totalTunai = 0;
        let totalNonTunai = 0;

        costsData.forEach(exp => {
            const docNo = exp.document_number || '-';
            const dateStr = exp.cost_date ? new Date(exp.cost_date).toLocaleDateString('id-ID') : '-';
            const amount = Number(exp.total_amount || 0);
            const method = exp.payment_method || 'Tunai';
            const notes = exp.notes || '-';
            const cashier = exp.profiles?.name || '-';

            totalSum += amount;
            if (method === 'Non-Tunai') {
                totalNonTunai += amount;
            } else {
                totalTunai += amount;
            }

            const items = itemsByCostId[exp.id] || [];
            const detailStr = items.map(it => {
                const catName = it.expense_items?.name || 'Item';
                const qty = it.quantity || 1;
                const price = Number(it.price || 0).toLocaleString('id-ID');
                const sub = Number(it.subtotal || 0).toLocaleString('id-ID');
                return `${catName} (${qty}x @Rp ${price} = Rp ${sub})`;
            }).join('; ');

            rowsSummary.push([docNo, dateStr, amount, method, detailStr || '-', notes, cashier]);
        });

        rowsSummary.push([]);
        rowsSummary.push(['TOTAL KESELURUHAN', '', totalSum, '', '', '', '']);
        rowsSummary.push(['TOTAL TUNAI', '', totalTunai, '', '', '', '']);
        rowsSummary.push(['TOTAL NON-TUNAI', '', totalNonTunai, '', '', '', '']);

        const wsSummary = window.XLSX.utils.aoa_to_sheet(rowsSummary);
        wsSummary['!cols'] = [
            { wch: 18 }, // No. Dokumen
            { wch: 14 }, // Tanggal Biaya
            { wch: 18 }, // Total (Rp)
            { wch: 18 }, // Metode Pembayaran
            { wch: 48 }, // Rincian Item Pengeluaran
            { wch: 35 }, // Keterangan
            { wch: 22 }  // Dicatat Oleh
        ];

        const z = '"Rp "#,##0;-"Rp "#,##0;"Rp "0';
        const rangeSummary = window.XLSX.utils.decode_range(wsSummary['!ref']);
        for (let R = 4; R <= rangeSummary.e.r; R++) {
            const cellRef = window.XLSX.utils.encode_cell({ r: R, c: 2 });
            if (wsSummary[cellRef] && typeof wsSummary[cellRef].v === 'number') {
                wsSummary[cellRef].z = z;
            }
        }

        // --- SHEET 2: Detail Item Biaya Operasional ---
        const rowsDetail = [
            ['Laporan Detail Item Biaya Operasional (Analisis)'],
            [`Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')}`],
            [],
            ['No. Dokumen', 'Tanggal Biaya', 'Kategori Biaya', 'Qty', 'Harga Satuan (Rp)', 'Subtotal (Rp)', 'Metode Pembayaran', 'Keterangan Dokumen', 'Dicatat Oleh (Kasir)']
        ];

        let detailTotalSum = 0;
        let detailTotalTunai = 0;
        let detailTotalNonTunai = 0;

        costsData.forEach(exp => {
            const docNo = exp.document_number || '-';
            const dateStr = exp.cost_date ? new Date(exp.cost_date).toLocaleDateString('id-ID') : '-';
            const method = exp.payment_method || 'Tunai';
            const notes = exp.notes || '-';
            const cashier = exp.profiles?.name || '-';

            const items = itemsByCostId[exp.id] || [];
            if (items.length === 0) {
                const amount = Number(exp.total_amount || 0);
                detailTotalSum += amount;
                if (method === 'Non-Tunai') detailTotalNonTunai += amount;
                else detailTotalTunai += amount;
                rowsDetail.push([docNo, dateStr, 'Pengeluaran Umum', 1, amount, amount, method, notes, cashier]);
            } else {
                items.forEach(it => {
                    const catName = it.expense_items?.name || 'Item';
                    const qty = Number(it.quantity || 1);
                    const price = Number(it.price || 0);
                    const subtotal = Number(it.subtotal || 0);

                    detailTotalSum += subtotal;
                    if (method === 'Non-Tunai') detailTotalNonTunai += subtotal;
                    else detailTotalTunai += subtotal;

                    rowsDetail.push([docNo, dateStr, catName, qty, price, subtotal, method, notes, cashier]);
                });
            }
        });

        rowsDetail.push([]);
        rowsDetail.push(['TOTAL KESELURUHAN', '', '', '', '', detailTotalSum, '', '', '']);
        rowsDetail.push(['TOTAL TUNAI', '', '', '', '', detailTotalTunai, '', '', '']);
        rowsDetail.push(['TOTAL NON-TUNAI', '', '', '', '', detailTotalNonTunai, '', '', '']);

        const wsDetail = window.XLSX.utils.aoa_to_sheet(rowsDetail);
        wsDetail['!cols'] = [
            { wch: 18 }, // No. Dokumen
            { wch: 14 }, // Tanggal Biaya
            { wch: 28 }, // Kategori Biaya
            { wch: 10 }, // Qty
            { wch: 18 }, // Harga Satuan
            { wch: 18 }, // Subtotal
            { wch: 18 }, // Metode Pembayaran
            { wch: 35 }, // Keterangan Dokumen
            { wch: 22 }  // Dicatat Oleh
        ];

        const rangeDetail = window.XLSX.utils.decode_range(wsDetail['!ref']);
        for (let R = 4; R <= rangeDetail.e.r; R++) {
            ['E', 'F'].forEach(col => {
                const cIdx = col === 'E' ? 4 : 5;
                const cellRef = window.XLSX.utils.encode_cell({ r: R, c: cIdx });
                if (wsDetail[cellRef] && typeof wsDetail[cellRef].v === 'number') {
                    wsDetail[cellRef].z = z;
                }
            });
        }

        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Biaya');
        window.XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Per Item');

        const filenameDate = new Date().toISOString().slice(0, 10);
        window.XLSX.writeFile(wb, `Laporan_Biaya_Operasional_${filenameDate}.xlsx`);
        showToast('Berhasil mengunduh Laporan Biaya Operasional', 'success');
    } catch (err) {
        console.error('Export Excel error:', err);
        showToast('Gagal mengekspor data ke Excel', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

window.exportExpensesToExcel = exportExpensesToExcel;
