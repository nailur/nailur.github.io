/* global XLSX */
import { supabase } from './supabase.js';
import { showToast } from './app.js';
import { activeOutletId } from './state.js';
import { printReceipt, printReceiptBluetooth } from './cart.js';
import { isPrinterConnected } from './printer.js';

export const HISTORY_PAGE_SIZE = 25;
export let historyPage = 0;
export let historyTotalCount = 0;

export async function exportToExcel() {
    if (!activeOutletId) return showToast('Pilih outlet terlebih dahulu', 'error');
    
    // Lazy load SheetJS jika belum dimuat
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
        const { data: trxData, error: trxError } = await supabase.from('transactions')
            .select('id, created_at, total_amount, payment_method, cashier_id, discount_amount, subtotal_amount, tax_amount, receipt_no, customer_name, cash_received, change_amount, status, profiles:profiles!transactions_cashier_id_fkey(email, name)')
            .eq('outlet_id', activeOutletId)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .order('created_at', { ascending: false });

        if (trxError) throw trxError;
        if (!trxData || trxData.length === 0) {
            showToast('Tidak ada data transaksi untuk diekspor', 'error');
            return;
        }

        const trxIds = trxData.map(t => t.id);
        const { data: itemsData, error: itemsError } = await supabase.from('transaction_items')
            .select('transaction_id, product_id, quantity, price, products(name)')
            .in('transaction_id', trxIds);

        if (itemsError) throw itemsError;

        const exportRows = [];
        
        for (const trx of trxData) {
            const cashierName = trx.profiles?.name || trx.profiles?.email || '-';
            const trxItems = itemsData.filter(i => i.transaction_id === trx.id);
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
        
        // Format currency columns (I=Harga Satuan, J=Subtotal Produk, K=Diskon, L=Pajak, M=Total Transaksi)
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
            { wch: 15 },  // ID Transaksi
            { wch: 20 },  // Tanggal
            { wch: 20 },  // Customer
            { wch: 20 },  // Kasir
            { wch: 10 },  // Status
            { wch: 15 },  // Metode Pembayaran
            { wch: 25 },  // Produk
            { wch: 10 },  // Kuantitas
            { wch: 15 },  // Harga Satuan
            { wch: 15 },  // Subtotal Produk
            { wch: 15 },  // Diskon
            { wch: 15 },  // Pajak
            { wch: 15 }   // Total Transaksi
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
    if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Memuat riwayat...</td></tr>';

    const from = historyPage * HISTORY_PAGE_SIZE;
    const to = from + HISTORY_PAGE_SIZE - 1;
    
    let query = supabase.from('transactions')
        .select('id, created_at, total_amount, payment_method, cashier_id, discount_amount, subtotal_amount, tax_amount, receipt_no, customer_name, transaction_notes, cash_received, change_amount, status, profiles:profiles!transactions_cashier_id_fkey(email, name)', { count: 'exact' })
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
        if(tbody) tbody.innerHTML = '<tr><td colspan="11" class="text-center">Belum ada transaksi</td></tr>';
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

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
                <td style="white-space: nowrap;">Rp ${(trx.discount_amount || 0).toLocaleString('id-ID')}</td>
                <td style="white-space: nowrap;">Rp ${(trx.tax_amount || 0).toLocaleString('id-ID')}</td>
                <td style="white-space: nowrap;"><strong>Rp ${(trx.total_amount || 0).toLocaleString('id-ID')}</strong></td>
                <td style="white-space: nowrap;">Rp ${(trx.cash_received || trx.total_amount).toLocaleString('id-ID')}</td>
                <td style="white-space: nowrap;">Rp ${(trx.change_amount || 0).toLocaleString('id-ID')}</td>
                <td>${trx.payment_method}</td>
                <td>
                    <button class="btn btn-icon" style="color:var(--primary);" onclick="viewTransactionDetails('${trx.id}')" title="Detail"><i class="ph ph-eye"></i></button>
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
        .select('id, created_at, total_amount, payment_method, cashier_id, discount_amount, subtotal_amount, tax_amount, receipt_no, customer_name, cash_received, change_amount, status, profiles:profiles!transactions_cashier_id_fkey(email, name), outlets(name, address, phone)')
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
    if (trx.transaction_notes) {
        document.getElementById('detail-trx-notes').textContent = trx.transaction_notes;
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
    
    // Jika printer Bluetooth terhubung, langsung cetak ke printer Bluetooth
    if (isPrinterConnected()) {
        printReceiptBluetooth(receiptNo, cartItems, trx.total_amount, received, trx.payment_method, trx.created_at, cashierName, trx.customer_name, totalsObj, outletObj, trx.transaction_notes);
    } else {
        // Fallback ke Web Print (browser print dialog)
        printReceipt(receiptNo, cartItems, trx.total_amount, received, trx.payment_method, trx.created_at, cashierName, trx.customer_name, totalsObj, outletObj, trx.transaction_notes);
    }
}

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
});
