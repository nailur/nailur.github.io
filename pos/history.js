import { supabase } from './supabase.js';
import { activeOutletId, showToast, generateReceiptNumber } from './app.js';
import { printReceipt } from './cart.js';

export const HISTORY_PAGE_SIZE = 25;
export let historyPage = 0;
export let historyTotalCount = 0;

export async function exportToExcel() {
    if (!activeOutletId) return showToast('Pilih outlet terlebih dahulu', 'error');
    
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
            .select('*, profiles(email, name)')
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
            .select('*, products(name)')
            .in('transaction_id', trxIds);

        if (itemsError) throw itemsError;

        const exportRows = [];
        
        for (const trx of trxData) {
            const cashierName = trx.profiles?.name || trx.profiles?.email || '-';
            const trxItems = itemsData.filter(i => i.transaction_id === trx.id);
            
            if (trxItems.length === 0) {
                exportRows.push({
                    'ID Transaksi': trx.id.substring(0, 8),
                    'Tanggal': new Date(trx.created_at).toLocaleString('id-ID'),
                    'Kasir': cashierName,
                    'Metode Pembayaran': trx.payment_method,
                    'Produk': '-',
                    'Kuantitas': 0,
                    'Harga Satuan': 0,
                    'Subtotal Produk': 0,
                    'Total Transaksi': trx.total_amount
                });
            } else {
                for (const item of trxItems) {
                    exportRows.push({
                        'ID Transaksi': trx.id.substring(0, 8),
                        'Tanggal': new Date(trx.created_at).toLocaleString('id-ID'),
                        'Kasir': cashierName,
                        'Metode Pembayaran': trx.payment_method,
                        'Produk': item.products?.name || 'Produk Terhapus',
                        'Kuantitas': item.quantity,
                        'Harga Satuan': item.price,
                        'Subtotal Produk': item.quantity * item.price,
                        'Total Transaksi': trx.total_amount 
                    });
                }
            }
        }

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Transaksi");
        
        const colWidths = [
            { wch: 15 }, 
            { wch: 20 }, 
            { wch: 25 }, 
            { wch: 15 }, 
            { wch: 25 }, 
            { wch: 10 }, 
            { wch: 15 }, 
            { wch: 15 }, 
            { wch: 15 }  
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
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);"><i class="ph ph-spinner ph-spin"></i> Memuat riwayat...</td></tr>';

    const from = historyPage * HISTORY_PAGE_SIZE;
    const to = from + HISTORY_PAGE_SIZE - 1;
    
    let query = supabase.from('transactions')
        .select('*, profiles(email, name)', { count: 'exact' })
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
        if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada transaksi</td></tr>';
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

    const rowsHTML = data.map(trx => {
        const receiptNo = trx.receipt_no || trx.id.substring(0, 8).toUpperCase();
        return `
            <tr>
                <td>${new Date(trx.created_at).toLocaleString('id-ID')}</td>
                <td>${receiptNo}</td>
                <td>Rp ${trx.total_amount.toLocaleString('id-ID')}</td>
                <td>${trx.payment_method}</td>
                <td>${trx.profiles?.name || trx.profiles?.email || '-'}</td>
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
        .select('*, profiles(email, name)')
        .eq('id', trxId)
        .single();
        
    const { data: items, error: itemsError } = await supabase.from('transaction_items')
        .select('*, products(name)')
        .eq('transaction_id', trxId);
        
    if (trxError || itemsError) return showToast('Gagal memuat detail transaksi', 'error');

    const receiptNo = trx.receipt_no || await generateReceiptNumber(trx);
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
    
    document.getElementById('detail-trx-method').textContent = trx.payment_method;
    
    const tbody = document.getElementById('detail-trx-items');
    tbody.innerHTML = items.map(item => `
        <tr>
            <td>${item.products?.name || 'Produk Terhapus'}</td>
            <td style="text-align: right;">${item.quantity}</td>
            <td style="text-align: right;">${item.price.toLocaleString('id-ID')}</td>
            <td style="text-align: right;">${(item.quantity * item.price).toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
    
    document.getElementById('detail-trx-total').textContent = `Rp ${trx.total_amount.toLocaleString('id-ID')}`;
    
    document.getElementById('btn-reprint-trx').onclick = () => reprintReceipt(trx, items);
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
        price: i.price
    }));
    const receiptNo = trx.receipt_no || await generateReceiptNumber(trx);
    const totalsObj = {
        subtotal: trx.subtotal_amount || trx.total_amount,
        discount: trx.discount_amount || 0,
        tax: trx.tax_amount || 0,
        total: trx.total_amount || 0
    };
    printReceipt(receiptNo, cartItems, trx.total_amount, trx.total_amount, trx.payment_method, trx.created_at, cashierName, trx.customer_name, totalsObj);
}
