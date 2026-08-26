/**
 * DOMPETKU UTILITY FUNCTIONS
 */

export function formatRupiah(amount, withPrefix = true) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return withPrefix ? 'Rp 0' : '0';
    }
    const num = Number(amount);
    const isNegative = num < 0;
    const absNum = Math.abs(num);
    
    const formatted = new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(absNum);

    const sign = isNegative ? '-' : '';
    return withPrefix ? `${sign}Rp ${formatted}` : `${sign}${formatted}`;
}

export function parseRupiahInput(value) {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^0-9]/g, '');
    return parseInt(cleaned, 10) || 0;
}

export function formatDate(dateStr, format = 'medium') {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';

    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthsLong = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    if (format === 'short') {
        return `${day} ${monthsShort[month]} ${year}`;
    } else if (format === 'time') {
        return `${hours}:${minutes}`;
    } else if (format === 'datetime') {
        return `${day} ${monthsShort[month]} ${year}, ${hours}:${minutes}`;
    } else if (format === 'full') {
        return `${days[date.getDay()]}, ${day} ${monthsLong[month]} ${year}`;
    } else if (format === 'input') {
        // YYYY-MM-DD
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${year}-${m}-${d}`;
    }
    return `${day} ${monthsShort[month]} ${year}`;
}

export function getLocalToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function showToast(message, type = 'success', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slide-in`;
    
    let iconClass = 'ph-check-circle';
    if (type === 'error' || type === 'danger') iconClass = 'ph-warning-circle';
    if (type === 'warning') iconClass = 'ph-warning';
    if (type === 'info') iconClass = 'ph-info';

    toast.innerHTML = `
        <i class="ph-bold ${iconClass} toast-icon"></i>
        <div class="toast-message">${escapeHtml(message)}</div>
        <button class="toast-close" aria-label="Close">&times;</button>
    `;

    toast.querySelector('.toast-close').onclick = () => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 250);
    };

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('animate-fade-out');
            setTimeout(() => toast.remove(), 250);
        }
    }, duration);
}

export function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

export function exportToExcel(filename, data, headers = []) {
    if (!window.XLSX) {
        showToast('Library SheetJS belum siap', 'error');
        return;
    }

    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Dompetku");
        XLSX.writeFile(wb, `${filename}.xlsx`);
        showToast('Laporan Excel berhasil diunduh', 'success');
    } catch (e) {
        console.error("Export error:", e);
        showToast('Gagal mengekspor file Excel', 'error');
    }
}

