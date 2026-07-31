/**
 * utils.js — NTPOS General Utility Functions
 * Contains: getLocalToday, showToast, showConfirm, debounce, escapeHtml,
 *           generateOrderId, generateRandomDocNumber, enableTableSort
 */

// Today's date based on browser local timezone (not UTC)
export function getLocalToday() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split('T')[0];
}

// Toast Notification
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    if (type === 'error') toast.style.background = 'var(--danger)';
    if (type === 'success') toast.style.background = 'var(--success)';

    toast.innerHTML = `
        <i class="ph-fill ph-${type === 'success' ? 'check-circle' : type === 'error' ? 'warning-circle' : 'info'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Confirmation Modal
export function showConfirm(message, onConfirm) {
    document.getElementById('confirm-message').textContent = message;
    const modal = document.getElementById('modal-confirm');
    const btnYes = document.getElementById('btn-confirm-yes');

    const newBtnYes = btnYes.cloneNode(true);
    btnYes.parentNode.replaceChild(newBtnYes, btnYes);

    newBtnYes.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (onConfirm) onConfirm();
    });

    modal.classList.remove('hidden');
}

// Debounce Utility
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// HTML Escape (XSS Protection)
export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Generate POS Order ID — emptyCart accessed via window to avoid circular dependency
export function generateOrderId(resetCart = true) {
    const id = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderIdEl = document.getElementById('current-order-id');
    if (orderIdEl) orderIdEl.textContent = id;

    if (resetCart) {
        if (window.emptyCart) window.emptyCart();
        const cashEl = document.getElementById('cash-received');
        if (cashEl) cashEl.value = '';
    }
}

// Generate random document number (Expenses, Deposits, etc.)
export function generateRandomDocNumber(prefix) {
    return prefix + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Table column sorting (called after table render)
export function enableTableSort(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const headers = table.querySelectorAll('th');

    headers.forEach((header, index) => {
        if (header.classList.contains('action-col')) return;

        header.style.cursor = 'pointer';
        header.title = 'Klik untuk mengurutkan';

        let sortAsc = true;

        header.addEventListener('click', () => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            const rows = Array.from(tbody.querySelectorAll('tr'));

            headers.forEach(h => {
                const icon = h.querySelector('.sort-icon');
                if (icon) icon.remove();
            });

            const icon = document.createElement('i');
            icon.className = `sort-icon ph ph-caret-${sortAsc ? 'up' : 'down'}`;
            icon.style.marginLeft = '5px';
            header.appendChild(icon);

            rows.sort((a, b) => {
                const cellA = a.querySelectorAll('td')[index]?.textContent.trim() || '';
                const cellB = b.querySelectorAll('td')[index]?.textContent.trim() || '';

                const numA = parseFloat(cellA.replace(/[^0-9.-]+/g, ''));
                const numB = parseFloat(cellB.replace(/[^0-9.-]+/g, ''));

                if (!isNaN(numA) && !isNaN(numB) && cellA.match(/[0-9]/) && cellB.match(/[0-9]/)) {
                    return sortAsc ? numA - numB : numB - numA;
                }
                return sortAsc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
            });

            tbody.innerHTML = '';
            rows.forEach(row => tbody.appendChild(row));

            sortAsc = !sortAsc;
        });
    });
}

// Register to window for inline HTML / non-module access
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.enableTableSort = enableTableSort;

