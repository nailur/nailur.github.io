import { supabase } from './supabase.js';
import { getActiveOutletId } from './state.js';

export async function loadShiftSessions() {
    const tbody = document.querySelector('#shift-sessions-table tbody');
    if (!tbody) return;

    // Gunakan filter tanggal dari input absensi
    const startDate = document.getElementById('attendance-start-date')?.value;
    const endDate = document.getElementById('attendance-end-date')?.value;
    const activeOutletId = getActiveOutletId();

    if (!activeOutletId) return;

    try {
        let query = supabase
            .from('shift_sessions')
            .select(`
                id, 
                status, 
                starting_cash, 
                ending_cash, 
                opened_at, 
                closed_at,
                opener:profiles!shift_sessions_user_id_fkey(name),
                closer:profiles!shift_sessions_closed_by_fkey(name)
            `)
            .eq('outlet_id', activeOutletId)
            .order('opened_at', { ascending: false });

        if (startDate && endDate) {
            // Karena opened_at berupa timestamptz, kita filter mulai 00:00:00 hingga 23:59:59
            query = query.gte('opened_at', `${startDate}T00:00:00.000Z`)
                         .lte('opened_at', `${endDate}T23:59:59.999Z`);
        }

        const { data, error } = await query;
        
        if (error) throw error;

        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">Belum ada riwayat shift</td></tr>`;
            return;
        }

        data.forEach(session => {
            const tr = document.createElement('tr');
            
            const openedDate = session.opened_at ? new Date(session.opened_at).toLocaleString('id-ID') : '-';
            const closedDate = session.closed_at ? new Date(session.closed_at).toLocaleString('id-ID') : '-';
            
            const openerName = session.opener?.name || 'Unknown';
            const closerName = session.closer?.name || '-';
            
            const startingCash = parseFloat(session.starting_cash || 0);
            const endingCash = session.ending_cash !== null ? parseFloat(session.ending_cash) : 0;
            const difference = endingCash - startingCash;
            
            let statusBadge = '';
            if (session.status === 'open') {
                statusBadge = `<span class="badge" style="background:var(--success); color:white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">Open</span>`;
            } else {
                statusBadge = `<span class="badge" style="background:var(--text-muted); color:white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">Closed</span>`;
            }

            let diffFormatted = '-';
            let diffColor = 'inherit';
            if (session.status === 'closed') {
                if (difference > 0) {
                    diffFormatted = `+Rp ${difference.toLocaleString('id-ID')}`;
                    diffColor = 'var(--success)';
                } else if (difference < 0) {
                    diffFormatted = `- Rp ${Math.abs(difference).toLocaleString('id-ID')}`;
                    diffColor = 'var(--danger)';
                } else {
                    diffFormatted = 'Rp 0';
                }
            }

            const formatRp = (val) => `Rp ${val.toLocaleString('id-ID')}`;

            tr.innerHTML = `
                <td>${openedDate}</td>
                <td>${closedDate}</td>
                <td>${window.escapeHtml(openerName)}</td>
                <td>${window.escapeHtml(closerName)}</td>
                <td>${statusBadge}</td>
                <td style="text-align: right;">${formatRp(startingCash)}</td>
                <td style="text-align: right;">${session.status === 'closed' ? formatRp(endingCash) : '-'}</td>
                <td style="text-align: right; font-weight: bold; color: ${diffColor}">${diffFormatted}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Gagal memuat riwayat shift:", err);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Gagal memuat data</td></tr>`;
    }
}
