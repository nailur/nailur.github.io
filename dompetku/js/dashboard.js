import { getState } from './state.js';
import { formatRupiah, formatDate, escapeHtml } from './utils.js';

let expenseChartInstance = null;
let cashflowChartInstance = null;

export function renderDashboard() {
    const { wallets, transactions, categories, budgets } = getState();

    // 1. Calculate Balances
    const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);

    // 2. Current Month Calculations
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let thisMonthIncome = 0;
    let thisMonthExpense = 0;
    const categorySpendingMap = new Map();

    transactions.forEach(t => {
        const d = new Date(t.transaction_date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            const amt = Number(t.amount || 0);
            if (t.type === 'income') {
                thisMonthIncome += amt;
            } else if (t.type === 'expense') {
                thisMonthExpense += amt;
                const catName = t.category?.name || 'Tanpa Kategori';
                const catColor = t.category?.color || '#6B7280';
                const existing = categorySpendingMap.get(catName) || { amount: 0, color: catColor };
                existing.amount += amt;
                categorySpendingMap.set(catName, existing);
            }
        }
    });

    const netCashflow = thisMonthIncome - thisMonthExpense;

    // Update DOM summary cards
    const totalBalanceEl = document.getElementById('dash-total-balance');
    if (totalBalanceEl) totalBalanceEl.textContent = formatRupiah(totalBalance);

    const monthIncomeEl = document.getElementById('dash-month-income');
    if (monthIncomeEl) monthIncomeEl.textContent = formatRupiah(thisMonthIncome);

    const monthExpenseEl = document.getElementById('dash-month-expense');
    if (monthExpenseEl) monthExpenseEl.textContent = formatRupiah(thisMonthExpense);

    const netCashflowEl = document.getElementById('dash-net-cashflow');
    if (netCashflowEl) {
        netCashflowEl.textContent = (netCashflow >= 0 ? '+' : '') + formatRupiah(netCashflow);
        netCashflowEl.className = `stat-value ${netCashflow >= 0 ? 'text-success' : 'text-danger'}`;
    }

    // Render Mini Wallets List
    renderDashboardWallets(wallets);

    // Render Recent Transactions
    renderRecentTransactions(transactions.slice(0, 5));

    // Render Charts
    renderExpenseBreakdownChart(categorySpendingMap);
    renderCashflowTrendChart(transactions);
}

function renderDashboardWallets(wallets) {
    const container = document.getElementById('dash-wallets-list');
    if (!container) return;

    if (!wallets || wallets.length === 0) {
        container.innerHTML = `<div class="empty-state-small">Belum ada dompet. Tambahkan dompet baru!</div>`;
        return;
    }

    container.innerHTML = wallets.map(w => `
        <div class="wallet-card-mini" style="border-left-color: ${escapeHtml(w.color || '#10B981')}">
            <div class="wallet-icon-box" style="background: ${escapeHtml(w.color || '#10B981')}22; color: ${escapeHtml(w.color || '#10B981')}">
                <i class="ph-bold ${escapeHtml(w.icon || 'ph-wallet')}"></i>
            </div>
            <div class="wallet-info">
                <div class="wallet-name">${escapeHtml(w.name)} ${w.is_default ? '<span class="badge-default">Utama</span>' : ''}</div>
                <div class="wallet-balance">${formatRupiah(w.balance)}</div>
            </div>
        </div>
    `).join('');
}

function renderRecentTransactions(transactions) {
    const container = document.getElementById('dash-recent-transactions');
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="ph-bold ph-receipt text-muted" style="font-size: 2.5rem;"></i>
                <p>Belum ada transaksi bulan ini.</p>
                <button class="btn btn-sm btn-primary" onclick="window.openTransactionModal('expense')">
                    <i class="ph-bold ph-plus"></i> Catat Sekarang
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(t => {
        let isExp = t.type === 'expense';
        let isInc = t.type === 'income';
        let icon = t.category?.icon || (isExp ? 'ph-arrow-up-right' : (isInc ? 'ph-arrow-down-left' : 'ph-arrows-left-right'));
        let color = t.category?.color || (isExp ? '#EF4444' : (isInc ? '#10B981' : '#3B82F6'));
        let sign = isExp ? '-' : (isInc ? '+' : '');
        let amountClass = isExp ? 'text-danger' : (isInc ? 'text-success' : 'text-primary');

        return `
            <div class="transaction-item">
                <div class="tx-icon-box" style="background: ${color}20; color: ${color};">
                    <i class="ph-bold ${escapeHtml(icon)}"></i>
                </div>
                <div class="tx-details">
                    <div class="tx-title">${escapeHtml(t.description)}</div>
                    <div class="tx-meta">
                        <span>${escapeHtml(t.category?.name || (t.type === 'transfer' ? 'Transfer' : 'Umum'))}</span> • 
                        <span>${escapeHtml(t.wallet?.name || 'Dompet')}</span> • 
                        <span>${formatDate(t.transaction_date, 'short')}</span>
                    </div>
                </div>
                <div class="tx-amount ${amountClass}">
                    ${sign}${formatRupiah(t.amount)}
                </div>
            </div>
        `;
    }).join('');
}

function renderExpenseBreakdownChart(categorySpendingMap) {
    const canvas = document.getElementById('chart-expense-breakdown');
    if (!canvas || !window.Chart) return;

    const labels = Array.from(categorySpendingMap.keys());
    const data = Array.from(categorySpendingMap.values()).map(v => v.amount);
    const colors = Array.from(categorySpendingMap.values()).map(v => v.color);

    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }

    if (labels.length === 0) {
        // Show placeholder
        labels.push('Belum Ada Pengeluaran');
        data.push(1);
        colors.push('#E5E7EB');
    }

    expenseChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: 'var(--surface, #ffffff)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { family: 'Inter', size: 11 },
                        color: 'var(--text-main, #111827)'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            return ` ${context.label}: ${formatRupiah(val)}`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function renderCashflowTrendChart(transactions) {
    const canvas = document.getElementById('chart-cashflow-trend');
    if (!canvas || !window.Chart) return;

    // Last 6 months labels
    const months = [];
    const incomeData = [0, 0, 0, 0, 0, 0];
    const expenseData = [0, 0, 0, 0, 0, 0];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
    }

    transactions.forEach(t => {
        const d = new Date(t.transaction_date);
        for (let i = 5; i >= 0; i--) {
            const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
            if (d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear()) {
                const idx = 5 - i;
                if (t.type === 'income') incomeData[idx] += Number(t.amount || 0);
                if (t.type === 'expense') expenseData[idx] += Number(t.amount || 0);
            }
        }
    });

    if (cashflowChartInstance) {
        cashflowChartInstance.destroy();
    }

    cashflowChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Pemasukan',
                    data: incomeData,
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                    borderRadius: 6
                },
                {
                    label: 'Pengeluaran',
                    data: expenseData,
                    backgroundColor: 'rgba(239, 68, 68, 0.85)',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        font: { family: 'Inter', size: 11 },
                        color: 'var(--text-main, #111827)'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${formatRupiah(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000) return (value / 1000000) + ' Jt';
                            if (value >= 1000) return (value / 1000) + ' Rb';
                            return value;
                        },
                        font: { size: 10 }
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    ticks: { font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}

