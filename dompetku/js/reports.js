import { getState } from './state.js';
import { formatRupiah, formatDate, exportToExcel, escapeHtml } from './utils.js';

export function renderReports() {
    const { transactions, categories, wallets } = getState();

    const monthSelect = document.getElementById('report-month-select');
    const yearSelect = document.getElementById('report-year-select');

    const now = new Date();
    const selectedMonth = monthSelect ? parseInt(monthSelect.value, 10) : now.getMonth();
    const selectedYear = yearSelect ? parseInt(yearSelect.value, 10) : now.getFullYear();

    // Filter transactions for selected period
    const filtered = transactions.filter(t => {
        const d = new Date(t.transaction_date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryStats = new Map();

    filtered.forEach(t => {
        const amt = Number(t.amount || 0);
        if (t.type === 'income') {
            totalIncome += amt;
        } else if (t.type === 'expense') {
            totalExpense += amt;

            const catName = t.category?.name || 'Lain-lain';
            const catIcon = t.category?.icon || 'ph-tag';
            const catColor = t.category?.color || '#6B7280';

            const stat = categoryStats.get(catName) || {
                name: catName,
                icon: catIcon,
                color: catColor,
                total: 0,
                count: 0
            };
            stat.total += amt;
            stat.count += 1;
            categoryStats.set(catName, stat);
        }
    });

    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // Update Report Summary
    const repIncome = document.getElementById('rep-total-income');
    if (repIncome) repIncome.textContent = formatRupiah(totalIncome);

    const repExpense = document.getElementById('rep-total-expense');
    if (repExpense) repExpense.textContent = formatRupiah(totalExpense);

    const repNet = document.getElementById('rep-net-savings');
    if (repNet) {
        repNet.textContent = (netSavings >= 0 ? '+' : '') + formatRupiah(netSavings);
        repNet.className = `stat-value ${netSavings >= 0 ? 'text-success' : 'text-danger'}`;
    }

    const repRate = document.getElementById('rep-savings-rate');
    if (repRate) repRate.textContent = `${savingsRate.toFixed(1)}%`;

    // Render Category Breakdown Table
    renderReportCategoryTable(categoryStats, totalExpense);

    // Render Detailed Transactions Table
    renderReportTransactionsTable(filtered);
}

function renderReportCategoryTable(categoryStats, totalExpense) {
    const tbody = document.getElementById('report-category-tbody');
    if (!tbody) return;

    const list = Array.from(categoryStats.values()).sort((a, b) => b.total - a.total);

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Tidak ada data pengeluaran pada periode ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => {
        const percentage = totalExpense > 0 ? (item.total / totalExpense) * 100 : 0;
        return `
            <tr>
                <td>
                    <div class="category-badge-wrapper">
                        <div class="category-icon-sm" style="background: ${item.color}22; color: ${item.color}">
                            <i class="ph-bold ${escapeHtml(item.icon)}"></i>
                        </div>
                        <span class="font-medium">${escapeHtml(item.name)}</span>
                    </div>
                </td>
                <td class="text-right font-semibold">${formatRupiah(item.total)}</td>
                <td class="text-right">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${percentage.toFixed(1)}%; background: ${item.color}"></div>
                    </div>
                    <span class="text-xs text-muted">${percentage.toFixed(1)}%</span>
                </td>
                <td class="text-center text-sm text-muted">${item.count}x</td>
            </tr>
        `;
    }).join('');
}

function renderReportTransactionsTable(transactions) {
    const tbody = document.getElementById('report-transactions-tbody');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Tidak ada riwayat transaksi pada periode ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = transactions.map(t => {
        const isExp = t.type === 'expense';
        const isInc = t.type === 'income';
        const amountClass = isExp ? 'text-danger' : (isInc ? 'text-success' : 'text-primary');
        const sign = isExp ? '-' : (isInc ? '+' : '');

        return `
            <tr>
                <td>${formatDate(t.transaction_date, 'datetime')}</td>
                <td>
                    <div class="font-medium">${escapeHtml(t.description)}</div>
                    ${t.notes ? `<div class="text-xs text-muted">${escapeHtml(t.notes)}</div>` : ''}
                </td>
                <td>
                    <span class="badge badge-subtle">${escapeHtml(t.category?.name || (t.type === 'transfer' ? 'Transfer' : '-'))}</span>
                </td>
                <td>${escapeHtml(t.wallet?.name || '-')}</td>
                <td class="text-right font-semibold ${amountClass}">
                    ${sign}${formatRupiah(t.amount)}
                </td>
            </tr>
        `;
    }).join('');
}

export function handleExportExcel() {
    const { transactions } = getState();
    const monthSelect = document.getElementById('report-month-select');
    const yearSelect = document.getElementById('report-year-select');

    const selectedMonth = monthSelect ? parseInt(monthSelect.value, 10) : new Date().getMonth();
    const selectedYear = yearSelect ? parseInt(yearSelect.value, 10) : new Date().getFullYear();

    const monthsLong = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const periodName = `${monthsLong[selectedMonth]}_${selectedYear}`;

    const filtered = transactions.filter(t => {
        const d = new Date(t.transaction_date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    const exportData = filtered.map((t, idx) => ({
        'No': idx + 1,
        'Tanggal': formatDate(t.transaction_date, 'datetime'),
        'Jenis': t.type === 'expense' ? 'Pengeluaran' : (t.type === 'income' ? 'Pemasukan' : 'Transfer'),
        'Keterangan': t.description,
        'Kategori': t.category?.name || '-',
        'Dompet': t.wallet?.name || '-',
        'Tujuan Transfer': t.to_wallet?.name || '-',
        'Nominal (Rp)': Number(t.amount),
        'Catatan': t.notes || '',
        'Sumber': t.source || 'web'
    }));

    exportToExcel(`Laporan_Dompetku_${periodName}`, exportData);
}

