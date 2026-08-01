/* global XLSX */
import { supabase } from './supabase.js';
import { showToast } from './utils.js';
import { activeOutletId } from './state.js';
import { printReceipt, printReceiptBluetooth } from './cart.js';
import { isPrinterConnected } from './printer.js';
import { getCurrentProfile } from './auth.js';

function canEditPaymentMethod() {
    const profile = getCurrentProfile();
    return profile && (profile.role === 'superadmin' || profile.role === 'owner');
}

export const HISTORY_PAGE_SIZE = 25;
export let historyPage = 0;
export let historyTotalCount = 0;

export async function exportToExcel() {
    if (!activeOutletId) return showToast('Pilih outlet terlebih dahulu', 'error');
    
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

    const startDate = document.getElementById('history-date-start').value;
    const endDate = document.getElementById('history-date-end').value;
    if (!startDate || !endDate) return showToast('Pilih rentang tanggal terlebih dahulu', 'error');
    
    const startOfDay = new Date(`${startDate}T00:00:00`).toISOString();
    const endOfDay = new Date(`${endDate}T23:59:59.999`).toISOString();

    const btn = document.getElementById('btn-export-excel');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Mengekspor...';

    try {
        // Audit Fix #5: Use nested select join (single HTTP request) to prevent
        // HTTP 414 URI Too Long errors from large .in('transaction_id', trxIds) queries.
        const { data: trxData, error: trxError } = await supabase.from('transactions')
            .select(`
                id, created_at, total_amount, payment_method, cashier_id,
                discount_amount, subtotal_amount, tax_amount, receipt_no,
                customer_name, cash_received, change_amount, status,
                profiles:profiles!transactions_cashier_id_fkey(email, name),
                items:transaction_items(product_id, quantity, price, products(name))
            `)
            .eq('outlet_id', activeOutletId)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .order('created_at', { ascending: false });

        if (trxError) throw trxError;

        if (!trxData || trxData.length === 0) {
            showToast('Tidak ada data transaksi untuk diekspor', 'error');
            return;
        }

        const exportRows = [];
        
        for (const trx of trxData) {
            const cashierName = trx.profiles?.name || trx.profiles?.email || '-';
            const trxItems = trx.items || [];
            const statusLabel = trx.status === 'voided' ? 'CANCEL' : 'Berhasil';
            const customerName = trx.customer_name || '-';
            
            if (trxItems.length === 0) {
                exportRows.push({
                    'ID Transaksi': trx.receipt_no || trx.id.substring(0, 8).toUpperCase(),
                    'Tanggal': new Date(trx.created_at).toLocaleString('id-ID'),
                    'Customer': customerName,
                    'Kasir': cashierName,
                    'Status': statusLabel,
                    'Metode Pembayaran': trx.payment_method,
                    'Produk': '-',
                    'Kuantitas': 0,
                    'Harga Satuan': 0,
                    'Subtotal Produk': 0,
                    'Diskon': trx.discount_amount || 0,
                    'Pajak': trx.tax_amount || 0,
                    'Total Transaksi': trx.total_amount
                });
            } else {
                trxItems.forEach((item, index) => {
                    const isFirst = index === 0;
                    exportRows.push({
                        'ID Transaksi': trx.receipt_no || trx.id.substring(0, 8).toUpperCase(),
                        'Tanggal': new Date(trx.created_at).toLocaleString('id-ID'),
                        'Customer': customerName,
                        'Kasir': cashierName,
                        'Status': statusLabel,
                        'Metode Pembayaran': trx.payment_method,
                        'Produk': item.products?.name || 'Produk Terhapus',
                        'Kuantitas': item.quantity,
                        'Harga Satuan': item.price,
                        'Subtotal Produk': item.quantity * item.price,
                        'Diskon': isFirst ? (trx.discount_amount || 0) : null,
                        'Pajak': isFirst ? (trx.tax_amount || 0) : null,
                        'Total Transaksi': isFirst ? trx.total_amount : null
                    });
                });
            }
        }

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        
        // Format currency columns (I=Unit Price, J=Product Subtotal, K=Discount, L=Tax, M=Total Transaction)
        for (let cell in worksheet) {
            if (cell[0] === '!') continue;
            const col = cell.replace(/[0-9]/g, '');
            const row = parseInt(cell.replace(/\D/g, ''), 10);
            if (['I', 'J', 'K', 'L', 'M'].includes(col) && row > 1) {
                worksheet[cell].z = '"Rp "#,##0';
            }
        }
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Transaksi");
        
        const colWidths = [
            { wch: 15 },  // Transaction ID
            { wch: 20 },  // Date
            { wch: 20 },  // Customer
            { wch: 20 },  // Cashier
            { wch: 10 },  // Status
            { wch: 15 },  // Payment Method
            { wch: 25 },  // Product
            { wch: 10 },  // Quantity
            { wch: 15 },  // Unit Price
            { wch: 15 },  // Product Subtotal
            { wch: 15 },  // Discount
            { wch: 15 },  // Tax
            { wch: 15 }   // Total Transaction
        ];
        worksheet['!cols'] = colWidths;

        let filenameDate = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
        XLSX.writeFile(workbook, `Laporan_Transaksi_${filenameDate}.xlsx`);
        showToast('Berhasil mengunduh Excel', 'success');

    } catch (e) {
        console.error(e);
        showToast('Gagal mengekspor Excel', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

export async function loadHistory(resetPage = true) {
    if (!activeOutletId) return;
    
    if (resetPage) historyPage = 0;

    const tbody = document.querySelector('#history-table tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Memuat riwayat...</td></tr>';

    const from = historyPage * HISTORY_PAGE_SIZE;
    const to = from + HISTORY_PAGE_SIZE - 1;
    
    let query = supabase.from('transactions')
        .select('id, created_at, total_amount, payment_method, cashier_id, discount_amount, subtotal_amount, tax_amount, receipt_no, customer_name, notes, cash_received, change_amount, status, profiles:profiles!transactions_cashier_id_fkey(email, name)', { count: 'exact' })
        .eq('outlet_id', activeOutletId)
        .order('created_at', { ascending: false });

    const startDate = document.getElementById('history-date-start');
    const endDate = document.getElementById('history-date-end');
    
    if (startDate && startDate.value && endDate && endDate.value) {
        const startOfDay = new Date(`${startDate.value}T00:00:00`).toISOString();
        const endOfDay = new Date(`${endDate.value}T23:59:59.999`).toISOString();
        
        query = query.gte('created_at', startOfDay)
                     .lte('created_at', endOfDay);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
        showToast('Gagal memuat riwayat', 'error');
        return;
    }

    historyTotalCount = count || 0;
    const paginationEl = document.getElementById('history-pagination');

    if (!data || data.length === 0) {
        if(tbody) tbody.innerHTML = '<tr><td colspan="12" class="text-center">Belum ada transaksi</td></tr>';
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

    window.historyTransactionsList = data;

    const rowsHTML = data.map(trx => {
        const receiptNo = trx.receipt_no || trx.id.substring(0, 8).toUpperCase();
        const isVoid = trx.status === 'voided';
        return `
            <tr ${isVoid ? 'style="opacity: 0.6;"' : ''}>
                <td>${new Date(trx.created_at).toLocaleString('id-ID')}</td>
                <td>
                    ${receiptNo}
                    ${isVoid ? '<span style="background:var(--danger);color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;margin-left:5px;">CANCEL</span>' : ''}
                </td>
                <td>${escapeHtml(trx.customer_name || '-')}</td>
                <td>${escapeHtml(trx.profiles?.name || trx.profiles?.email || '-')}</td>
                <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(trx.notes || '')}">${escapeHtml(trx.notes || '-')}</td>
                <td style="white-space: nowrap;">Rp ${(trx.discount_amount || 0).toLocaleString('id-ID')}</td>
                <td style="white-space: nowrap;">Rp ${(trx.tax_amount || 0).toLocaleString('id-ID')}</td>
                <td style="white-space: nowrap;"><strong>Rp ${(trx.total_amount || 0).toLocaleString('id-ID')}</strong></td>
                <td style="white-space: nowrap;">Rp ${(trx.cash_received || trx.total_amount).toLocaleString('id-ID')}</td>
                <td style="white-space: nowrap;">Rp ${(trx.change_amount || 0).toLocaleString('id-ID')}</td>
                <td>${trx.payment_method}</td>
                <td style="white-space: nowrap;">
                    <button class="btn btn-icon" style="color:var(--primary); margin-right: 4px;" onclick="viewTransactionDetails('${trx.id}')" title="Detail Transaksi"><i class="ph ph-eye"></i></button>
                    <button class="btn btn-icon" style="color:var(--primary); margin-right: 4px;" onclick="reprintTransactionById('${trx.id}')" title="Cetak Ulang Struk"><i class="ph ph-printer"></i></button>
                    ${!isVoid && canEditPaymentMethod() ? `
                        <button class="btn btn-icon" style="color:var(--warning);" onclick="window.openEditPaymentMethodModal('${trx.id}')" title="Edit Metode Pembayaran & Customer"><i class="ph ph-pencil-simple"></i></button>
                    ` : ''}
                </td>
            </tr>
        `;
    });
    if(tbody) tbody.innerHTML = rowsHTML.join('');
    
    if (window.enableTableSort) {
        window.enableTableSort('history-table');
    }

    const totalPages = Math.ceil(historyTotalCount / HISTORY_PAGE_SIZE);
    if (paginationEl && totalPages > 1) {
        const currentPage = historyPage + 1;
        paginationEl.innerHTML = `
            <button ${historyPage === 0 ? 'disabled' : ''} onclick="changeHistoryPage(${historyPage - 1})">
                <i class="ph ph-caret-left"></i> Prev
            </button>
            <span class="pagination-info">Halaman ${currentPage} dari ${totalPages} (${historyTotalCount} transaksi)</span>
            <button ${currentPage >= totalPages ? 'disabled' : ''} onclick="changeHistoryPage(${historyPage + 1})">
                Next <i class="ph ph-caret-right"></i>
            </button>
        `;
    } else if (paginationEl) {
        paginationEl.innerHTML = historyTotalCount > 0 ? `<span class="pagination-info">${historyTotalCount} transaksi</span>` : '';
    }
}

export function changeHistoryPage(page) {
    historyPage = page;
    loadHistory(false);
}

export async function viewTransactionDetails(trxId) {
    const { data: trx, error: trxError } = await supabase.from('transactions')
        .select('id, created_at, total_amount, payment_method, cashier_id, discount_amount, subtotal_amount, tax_amount, receipt_no, customer_name, notes, cash_received, change_amount, status, profiles:profiles!transactions_cashier_id_fkey(email, name), outlets(name, address, phone)')
        .eq('id', trxId)
        .single();
        
    const { data: items, error: itemsError } = await supabase.from('transaction_items')
        .select('transaction_id, product_id, quantity, price, modifiers, products(name)')
        .eq('transaction_id', trxId);
        
    if (trxError || itemsError) return showToast('Gagal memuat detail transaksi', 'error');

    const receiptNo = trx.receipt_no || trx.id.substring(0, 8).toUpperCase();
    document.getElementById('detail-trx-id').textContent = receiptNo;
    document.getElementById('detail-trx-date').textContent = new Date(trx.created_at).toLocaleString('id-ID');
    document.getElementById('detail-trx-cashier').textContent = trx.profiles?.name || trx.profiles?.email || '-';
    
    const customerWrapper = document.getElementById('detail-trx-customer-wrapper');
    if (trx.customer_name) {
        document.getElementById('detail-trx-customer').textContent = trx.customer_name;
        if (customerWrapper) customerWrapper.style.display = 'block';
    } else {
        if (customerWrapper) customerWrapper.style.display = 'none';
    }
    
    const notesWrapper = document.getElementById('detail-trx-notes-wrapper');
    if (trx.notes) {
        document.getElementById('detail-trx-notes').textContent = trx.notes;
        if (notesWrapper) notesWrapper.style.display = 'block';
    } else {
        if (notesWrapper) notesWrapper.style.display = 'none';
    }
    
    document.getElementById('detail-trx-method').textContent = trx.payment_method;
    
    const tbody = document.getElementById('detail-trx-items');
    tbody.innerHTML = items.map(item => {
        const modText = item.modifiers && item.modifiers.length > 0
            ? item.modifiers.map(m => `<div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(m.name)}</div>`).join('')
            : '';
        return `
        <tr>
            <td>${escapeHtml(item.products?.name || 'Produk Terhapus')}${modText}</td>
            <td style="text-align: right;">${item.quantity}</td>
            <td style="text-align: right;">${item.price.toLocaleString('id-ID')}</td>
            <td style="text-align: right;">${(item.quantity * item.price).toLocaleString('id-ID')}</td>
        </tr>
    `}).join('');
    
    const tfoot = document.querySelector('#modal-transaction-details tfoot');
    let tfootHTML = '';
    
    if (trx.subtotal_amount && trx.subtotal_amount !== trx.total_amount || trx.discount_amount > 0 || trx.tax_amount > 0) {
        const subtotal = trx.subtotal_amount || trx.total_amount;
        tfootHTML += `
            <tr>
                <th colspan="3" style="text-align: right; font-weight: normal; font-size: 0.9rem;">Subtotal</th>
                <th style="text-align: right; font-weight: normal; font-size: 0.9rem;">${subtotal.toLocaleString('id-ID')}</th>
            </tr>
        `;
        if (trx.discount_amount > 0) {
            tfootHTML += `
                <tr>
                    <th colspan="3" style="text-align: right; font-weight: normal; font-size: 0.9rem; color: var(--danger);">Diskon</th>
                    <th style="text-align: right; font-weight: normal; font-size: 0.9rem; color: var(--danger);">- ${trx.discount_amount.toLocaleString('id-ID')}</th>
                </tr>
            `;
        }
        if (trx.tax_amount > 0) {
            tfootHTML += `
                <tr>
                    <th colspan="3" style="text-align: right; font-weight: normal; font-size: 0.9rem;">Pajak</th>
                    <th style="text-align: right; font-weight: normal; font-size: 0.9rem;">${trx.tax_amount.toLocaleString('id-ID')}</th>
                </tr>
            `;
        }
    }
    
    if (trx.cash_received !== undefined && trx.cash_received !== null) {
        tfootHTML += `
            <tr>
                <th colspan="3" style="text-align: right;">TOTAL</th>
                <th id="detail-trx-total" style="text-align: right; color: var(--primary); font-size: 1.1rem;">Rp ${trx.total_amount.toLocaleString('id-ID')}</th>
            </tr>
            <tr>
                <th colspan="3" style="text-align: right; font-weight: normal; font-size: 0.9rem;">Tunai</th>
                <th style="text-align: right; font-weight: normal; font-size: 0.9rem;">${trx.cash_received.toLocaleString('id-ID')}</th>
            </tr>
            <tr>
                <th colspan="3" style="text-align: right; font-weight: normal; font-size: 0.9rem;">Kembali</th>
                <th style="text-align: right; font-weight: normal; font-size: 0.9rem;">${trx.change_amount.toLocaleString('id-ID')}</th>
            </tr>
        `;
    } else {
        tfootHTML += `
            <tr>
                <th colspan="3" style="text-align: right;">TOTAL</th>
                <th id="detail-trx-total" style="text-align: right; color: var(--primary); font-size: 1.1rem;">Rp ${trx.total_amount.toLocaleString('id-ID')}</th>
            </tr>
        `;
    }
    
    tfoot.innerHTML = tfootHTML;
    
    let actionButtons = `
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-transaction-details').classList.add('hidden')">Tutup</button>
        <button type="button" class="btn btn-primary" onclick="window.reprintReceiptWrapper()">Cetak Ulang</button>
    `;

    if (trx.status !== 'voided') {
        actionButtons = `
            <button class="btn btn-outline" style="color: var(--danger); border-color: var(--danger); margin-right: auto;" onclick="window.openVoidModal('${trx.id}')" title="Cancel Transaksi">
                <i class="ph ph-prohibit"></i> Cancel
            </button>
            ` + actionButtons;
    } else {
        actionButtons = `
            <span style="background:var(--danger);color:white;padding:8px 12px;border-radius:6px;font-weight:bold;margin-right:auto;">CANCELED</span>
            ` + actionButtons;
    }
    
    const actionsContainer = document.getElementById('detail-trx-actions');
    if (actionsContainer) {
        actionsContainer.innerHTML = actionButtons;
    } else {
        document.getElementById('btn-reprint-trx').onclick = () => reprintReceipt(trx, items);
    }
    
    window.reprintReceiptWrapper = () => reprintReceipt(trx, items);
    
    document.getElementById('modal-transaction-details').classList.remove('hidden');
}

export async function reprintReceipt(trx, items) {
    let cashierName = null;
    if (trx.profiles) {
        cashierName = trx.profiles.name || trx.profiles.email;
    }
    const cartItems = items.map(i => ({
        name: i.products?.name || 'Produk',
        quantity: i.quantity,
        price: i.price,
        modifiers: i.modifiers
    }));
    const receiptNo = trx.receipt_no || trx.id.substring(0, 8).toUpperCase();
    const totalsObj = {
        subtotal: trx.subtotal_amount || trx.total_amount,
        discount: trx.discount_amount || 0,
        tax: trx.tax_amount || 0,
        total: trx.total_amount || 0
    };
    const received = trx.cash_received || trx.total_amount;
    const outletObj = trx.outlets || null;
    
    // Print directly to connected Bluetooth thermal printer if available
    if (isPrinterConnected()) {
        printReceiptBluetooth(receiptNo, cartItems, trx.total_amount, received, trx.payment_method, trx.created_at, cashierName, trx.customer_name, totalsObj, outletObj, trx.notes);
    } else {
        // Fallback to browser standard print dialog
        printReceipt(receiptNo, cartItems, trx.total_amount, received, trx.payment_method, trx.created_at, cashierName, trx.customer_name, totalsObj, outletObj, trx.notes);
    }
}

export async function reprintTransactionById(trxId) {
    if (typeof window.showToast === 'function') window.showToast('Menyiapkan cetak ulang struk...', 'info');
    
    const { data: trx, error: trxError } = await supabase.from('transactions')
        .select('id, created_at, total_amount, payment_method, cashier_id, discount_amount, subtotal_amount, tax_amount, receipt_no, customer_name, notes, cash_received, change_amount, status, profiles:profiles!transactions_cashier_id_fkey(email, name), outlets(name, address, phone)')
        .eq('id', trxId)
        .single();
        
    const { data: items, error: itemsError } = await supabase.from('transaction_items')
        .select('transaction_id, product_id, quantity, price, modifiers, products(name)')
        .eq('transaction_id', trxId);
        
    if (trxError || itemsError) {
        if (typeof window.showToast === 'function') window.showToast('Gagal memuat data struk transaksi', 'error');
        return;
    }

    await reprintReceipt(trx, items);
}

window.reprintTransactionById = reprintTransactionById;

window.openVoidModal = function(trxId) {
    document.getElementById('void-trx-id').value = trxId;
    document.getElementById('void-reason').value = '';
    const modal = document.getElementById('modal-void');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('void-reason').focus();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const formVoid = document.getElementById('form-void');
    if (formVoid) {
        formVoid.addEventListener('submit', async (e) => {
            e.preventDefault();
            const trxId = document.getElementById('void-trx-id').value;
            const reason = document.getElementById('void-reason').value;
            
            const { data: sessionData } = await supabase.auth.getSession();
            const currentUser = window.getCurrentUser ? window.getCurrentUser() : sessionData.session?.user;
            if (!currentUser) return showToast('User tidak ditemukan', 'error');

            const submitBtn = formVoid.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Proses...';
            submitBtn.disabled = true;

            try {
                const { data, error } = await supabase.rpc('void_transaction', {
                    p_id: trxId,
                    p_reason: reason,
                    p_voided_by: currentUser.id
                });

                if (error) throw error;
                
                if (typeof window.showToast === 'function') window.showToast('Transaksi berhasil di-cancel', 'success');
                document.getElementById('modal-void').classList.add('hidden');
                document.getElementById('modal-transaction-details').classList.add('hidden');
                
                // Reload dashboard and history
                loadHistory(false);
                if (window.loadDashboard) window.loadDashboard();
            } catch (err) {
                console.error('Void error:', err);
                if (typeof window.showToast === 'function') window.showToast(err.message || 'Gagal membatalkan transaksi', 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    const pmSelect = document.getElementById('edit-pm-select');
    const cashWrapper = document.getElementById('edit-pm-cash-wrapper');
    const cashInput = document.getElementById('edit-pm-cash-received');
    const changeDisplay = document.getElementById('edit-pm-change-display');
    const totalEl = document.getElementById('edit-pm-total-amount');

    function updateChangeDisplay() {
        const total = Number(totalEl?.dataset?.amount || 0);
        const cash = Number(cashInput?.value || 0);
        const change = Math.max(0, cash - total);
        if (changeDisplay) changeDisplay.textContent = `Rp ${change.toLocaleString('id-ID')}`;
    }

    if (pmSelect) {
        pmSelect.addEventListener('change', () => {
            if (pmSelect.value === 'Tunai') {
                if (cashWrapper) cashWrapper.style.display = 'block';
                const total = Number(totalEl?.dataset?.amount || 0);
                if (!cashInput.value || Number(cashInput.value) < total) {
                    if (cashInput) cashInput.value = total;
                }
                updateChangeDisplay();
            } else {
                if (cashWrapper) cashWrapper.style.display = 'none';
            }
        });
    }

    if (cashInput) {
        cashInput.addEventListener('input', updateChangeDisplay);
    }

    const formEditPm = document.getElementById('form-edit-payment-method');
    if (formEditPm) {
        formEditPm.addEventListener('submit', handleSaveEditPaymentMethod);
    }
});

window.openEditPaymentMethodModal = async function(trxId) {
    if (!canEditPaymentMethod() || !trxId) return;

    const modal = document.getElementById('modal-edit-payment-method');
    if (!modal) return;

    let trx = (window.historyTransactionsList || []).find(t => String(t.id) === String(trxId));

    if (!trx || !trx.customer_name) {
        const { data: dbTrx, error } = await supabase.from('transactions')
            .select('id, receipt_no, total_amount, payment_method, cash_received, change_amount, customer_name')
            .eq('id', trxId)
            .single();

        if (error || !dbTrx) {
            if (!trx) {
                showToast('Gagal memuat data transaksi', 'error');
                return;
            }
        } else {
            trx = { ...trx, ...dbTrx };
        }
    }

    const receiptNo = trx.receipt_no || trx.id.substring(0, 8).toUpperCase();
    document.getElementById('edit-pm-trx-id').value = trx.id;
    document.getElementById('edit-pm-receipt-no').textContent = receiptNo;
    
    const totalEl = document.getElementById('edit-pm-total-amount');
    if (totalEl) {
        totalEl.textContent = `Rp ${Number(trx.total_amount || 0).toLocaleString('id-ID')}`;
        totalEl.dataset.amount = trx.total_amount || 0;
    }

    const customerEl = document.getElementById('edit-pm-customer-name');
    if (customerEl) {
        const cName = (trx.customer_name && trx.customer_name !== '-') ? trx.customer_name : '';
        customerEl.value = cName;
    }

    const selectEl = document.getElementById('edit-pm-select');
    const currentMethod = trx.payment_method || 'Tunai';

    if (selectEl) {
        if (currentMethod !== 'Tunai') {
            selectEl.innerHTML = `<option value="${currentMethod}">${currentMethod} (Tidak dapat diganti)</option>`;
            selectEl.value = currentMethod;
            selectEl.disabled = true;
        } else {
            selectEl.innerHTML = `
                <option value="Tunai">Tunai</option>
                <option value="QRIS">QRIS</option>
                <option value="Bank Transfer">Bank Transfer</option>
            `;
            selectEl.value = 'Tunai';
            selectEl.disabled = false;
        }
    }

    const cashWrapper = document.getElementById('edit-pm-cash-wrapper');
    const cashInput = document.getElementById('edit-pm-cash-received');
    const changeDisplay = document.getElementById('edit-pm-change-display');

    if (currentMethod === 'Tunai') {
        if (cashWrapper) cashWrapper.style.display = 'block';
        if (cashInput) cashInput.value = trx.cash_received || trx.total_amount || 0;
        const change = Math.max(0, Number(trx.cash_received || trx.total_amount || 0) - Number(trx.total_amount || 0));
        if (changeDisplay) changeDisplay.textContent = `Rp ${change.toLocaleString('id-ID')}`;
    } else {
        if (cashWrapper) cashWrapper.style.display = 'none';
        if (cashInput) cashInput.value = trx.total_amount || 0;
        if (changeDisplay) changeDisplay.textContent = 'Rp 0';
    }

    modal.classList.remove('hidden');
};

async function handleSaveEditPaymentMethod(e) {
    e.preventDefault();
    if (!canEditPaymentMethod()) return;

    const trxId = document.getElementById('edit-pm-trx-id')?.value;
    const newMethod = document.getElementById('edit-pm-select')?.value;
    const customerName = document.getElementById('edit-pm-customer-name')?.value?.trim() || null;
    const totalAmount = Number(document.getElementById('edit-pm-total-amount')?.dataset?.amount || 0);
    if (!trxId || !newMethod) return;

    const currentTrx = (window.historyTransactionsList || []).find(t => String(t.id) === String(trxId));
    const currentMethod = currentTrx?.payment_method || newMethod;

    if (currentMethod !== 'Tunai' && newMethod !== currentMethod) {
        showToast('Metode pembayaran selain Tunai tidak dapat diganti', 'error');
        return;
    }
    if (currentMethod === 'Tunai' && !['Tunai', 'QRIS', 'Bank Transfer'].includes(newMethod)) {
        showToast('Metode pembayaran Tunai hanya bisa diganti ke Tunai, QRIS, atau Bank Transfer', 'error');
        return;
    }

    const btnSubmit = document.getElementById('btn-save-edit-pm');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Memproses...';
    }

    let cashReceived = totalAmount;
    let changeAmount = 0;

    if (newMethod === 'Tunai') {
        const inputCash = Number(document.getElementById('edit-pm-cash-received')?.value || 0);
        cashReceived = Math.max(inputCash, totalAmount);
        changeAmount = Math.max(0, cashReceived - totalAmount);
    }

    const { error } = await supabase.from('transactions')
        .update({
            payment_method: newMethod,
            cash_received: cashReceived,
            change_amount: changeAmount,
            customer_name: customerName
        })
        .eq('id', trxId);

    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Simpan Perubahan';
    }

    if (error) {
        console.error('Edit payment method error:', error);
        showToast('Gagal mengubah data transaksi', 'error');
    } else {
        showToast('Data transaksi berhasil diubah', 'success');
        document.getElementById('modal-edit-payment-method')?.classList.add('hidden');
        loadHistory(false);
        if (typeof window.loadDashboard === 'function') window.loadDashboard();
    }
}
