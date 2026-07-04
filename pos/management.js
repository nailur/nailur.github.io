import { supabase } from './supabase.js';
import { showToast } from './app.js';
import { 
    branchesList, outletsList, 
    setBranchesList, setOutletsList 
} from './state.js';

export async function initManagement() {
    const profile = window.getCurrentProfile();
    const role = profile?.role;
    
    const tabBranches = document.querySelector('.tab-btn[data-target="branches-tab"]');
    const tabOutlets = document.querySelector('.tab-btn[data-target="outlets-tab"]');
    const tabServerInfo = document.querySelector('.tab-btn[data-target="server-info-tab"]');
    const tabAnnouncement = document.querySelector('.tab-btn[data-target="announcement-tab"]');
    
    if (role === 'superadmin' || role === 'owner') {
        tabBranches.classList.remove('hidden');
        tabOutlets.classList.remove('hidden');
        if(role === 'superadmin') {
            if (tabServerInfo) tabServerInfo.classList.remove('hidden');
            if (tabAnnouncement) tabAnnouncement.classList.remove('hidden');
        } else {
            if (tabServerInfo) tabServerInfo.classList.add('hidden');
            if (tabAnnouncement) tabAnnouncement.classList.add('hidden');
        }
        document.getElementById('management-title').textContent = 'Manajemen Sistem';
    } else if (role === 'kepala_cabang') {
        tabBranches.classList.add('hidden');
        tabOutlets.classList.remove('hidden');
        if(tabServerInfo) tabServerInfo.classList.add('hidden');
        if(tabAnnouncement) tabAnnouncement.classList.add('hidden');
        document.getElementById('management-title').textContent = 'Panel Kepala Cabang';
    } else if (role === 'kepala_toko') {
        tabBranches.classList.add('hidden');
        tabOutlets.classList.add('hidden');
        if(tabServerInfo) tabServerInfo.classList.add('hidden');
        if(tabAnnouncement) tabAnnouncement.classList.add('hidden');
        document.getElementById('management-title').textContent = 'Panel Kepala Toko';
    }
    
    const savedMgmtTab = localStorage.getItem('management_active_tab');
    let tabToClick = null;
    
    if (savedMgmtTab) {
        const btn = document.querySelector(`.tab-btn[data-target="${savedMgmtTab}"]`);
        if (btn && !btn.classList.contains('hidden')) {
            tabToClick = btn;
        }
    }
    
    if (!tabToClick) {
        if (!tabBranches.classList.contains('hidden')) {
            tabToClick = tabBranches;
        } else if (!tabOutlets.classList.contains('hidden')) {
            tabToClick = tabOutlets;
        } else {
            tabToClick = document.querySelector('.tab-btn[data-target="users-tab"]');
        }
    }
    
    if (tabToClick) tabToClick.click();

    if (role === 'superadmin' || role === 'owner' || role === 'kepala_cabang') await loadBranches();
    if (role === 'superadmin' || role === 'owner' || role === 'kepala_cabang') await loadOutlets();
    await loadUsers();
    
    // Initialize SA Attendance tab
    const saAttStart = document.getElementById('sa-attendance-start');
    if (saAttStart && !saAttStart.value) {
        const todayStr = new Date().toISOString().split('T')[0];
        saAttStart.value = todayStr;
        document.getElementById('sa-attendance-end').value = todayStr;
        
        const saAttOutlet = document.getElementById('sa-attendance-outlet');
        if (saAttOutlet) {
            saAttOutlet.innerHTML = '<option value="all">Semua Outlet</option>';
            let outList = outletsList;
            if (role === 'kepala_cabang') outList = outletsList.filter(o => o.branch_id === profile.branch_id);
            else if (role === 'kepala_toko') outList = outletsList.filter(o => o.id === profile.outlet_id);
            
            outList.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.id;
                opt.textContent = o.name;
                saAttOutlet.appendChild(opt);
            });
        }
    }
    
    if (role === 'superadmin') {
        const formAnnouncement = document.getElementById('form-announcement');
        if (formAnnouncement && !formAnnouncement.dataset.bound) {
            formAnnouncement.addEventListener('submit', window.sendCustomNotification);
            formAnnouncement.dataset.bound = 'true';
        }
        if (window.loadTargetUsers) await window.loadTargetUsers();
    }
}

export async function loadBranches() {
    let query = supabase.from('branches').select('id, name, created_at').order('created_at', { ascending: false });
    const profile = window.getCurrentProfile();
    if (profile?.role === 'kepala_cabang') {
        query = query.eq('id', profile.branch_id);
    }
    const { data, error } = await query;
    if (error) return showToast('Gagal memuat cabang', 'error');
    setBranchesList(data);
    const tbody = document.querySelector('#branches-table tbody');
    if (tbody) {
        tbody.innerHTML = data.map(b => `
            <tr>
                <td><strong>${b.name}</strong></td>
                <td>
                    <button class="btn btn-icon" style="color:var(--primary)" onclick="editBranch('${b.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn btn-icon" onclick="deleteBranch('${b.id}')"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
        if (window.enableTableSort) window.enableTableSort('branches-table');
    }
}

export async function loadOutlets() {
    let query = supabase.from('outlets').select('id, name, code, address, branch_id, tax_rate_percent, phone, created_at, branches(name)').order('created_at', { ascending: false });
    const profile = window.getCurrentProfile();
    if (profile?.role === 'kepala_cabang') {
        query = query.eq('branch_id', profile.branch_id);
    }
    const { data, error } = await query;
    if (error) return showToast('Gagal memuat outlet', 'error');
    setOutletsList(data);
    const tbody = document.querySelector('#outlets-table tbody');
    if (tbody) {
        tbody.innerHTML = data.map(o => `
            <tr>
                <td><strong>${o.name}</strong></td>
                <td><strong>${o.code || '-'}</strong></td>
                <td>${o.branches?.name || '-'}</td>
                <td>${o.address || '-'}</td>
                <td>
                    <button class="btn btn-icon" style="color:var(--primary)" onclick="editOutlet('${o.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn btn-icon" onclick="deleteOutlet('${o.id}')"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
        if (window.enableTableSort) window.enableTableSort('outlets-table');
    }
}

export async function loadUsers() {
    let query = supabase.from('profiles').select('id, email, name, role, branch_id, outlet_id, status, created_at, outlets(name), branches(name)').neq('role', 'superadmin');
    const profile = window.getCurrentProfile();
    if (profile?.role === 'kepala_cabang') {
        const { data: bOutlets } = await supabase.from('outlets').select('id').eq('branch_id', profile.branch_id);
        const outletIds = bOutlets ? bOutlets.map(o => o.id) : [];
        if (outletIds.length > 0) {
            query = query.or(`branch_id.eq.${profile.branch_id},outlet_id.in.(${outletIds.join(',')})`);
        } else {
            query = query.eq('branch_id', profile.branch_id);
        }
    } else if (profile?.role === 'kepala_toko') {
        query = query.eq('outlet_id', profile.outlet_id);
    }
    const { data, error } = await query;
    if (error) return showToast('Gagal memuat pegawai', 'error');
    const tbody = document.querySelector('#users-table tbody');
    if (tbody) {
        tbody.innerHTML = data.map(u => `
            <tr>
                <td>${u.name || '-'}</td>
                <td>${u.email}</td>
                <td><span class="user-badge">${u.role}</span></td>
                <td>${u.branches?.name || '-'}</td>
                <td>${u.outlets?.name || '-'}</td>
                <td>${u.status === 'inactive' ? '<span class="user-badge" style="background:var(--danger)">Inactive</span>' : '<span class="user-badge" style="background:var(--success)">Active</span>'}</td>
                <td>
                    <button class="btn btn-icon" style="color:var(--primary)" onclick="editUser('${u.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn btn-icon" onclick="deleteUser('${u.id}')"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');
        if (window.enableTableSort) window.enableTableSort('users-table');
    }
}

export async function handleAddBranch(e) {
    e.preventDefault();
    const id = document.getElementById('branch-id').value;
    const name = document.getElementById('branch-name').value;
    
    if (id) {
        const { error } = await supabase.from('branches').update({ name }).eq('id', id);
        if (error) showToast(error.message, 'error');
        else { showToast('Cabang diperbarui!', 'success'); document.getElementById('modal-branch').classList.add('hidden'); loadBranches(); }
    } else {
        const { error } = await supabase.from('branches').insert([{ name }]);
        if (error) showToast(error.message, 'error');
        else { showToast('Cabang ditambahkan!', 'success'); document.getElementById('modal-branch').classList.add('hidden'); loadBranches(); }
    }
}

export function editBranch(id) {
    const b = branchesList.find(x => x.id === id);
    if (!b) return;
    document.getElementById('branch-id').value = b.id;
    document.getElementById('branch-name').value = b.name;

    document.getElementById('modal-branch').classList.remove('hidden');
}

export async function deleteBranch(id) {
    if(!confirm('Hapus cabang ini?')) return;
    
    const { count, error: countErr } = await supabase.from('outlets').select('id', { count: 'exact', head: true }).eq('branch_id', id);
    if(countErr) return showToast('Gagal memvalidasi cabang', 'error');
    if(count > 0) return showToast('Cabang tidak bisa dihapus karena masih memiliki outlet!', 'error');

    const { error } = await supabase.from('branches').delete().eq('id', id);
    if(error) showToast(error.message, 'error');
    else loadBranches();
}

export async function handleAddOutlet(e) {
    e.preventDefault();
    const id = document.getElementById('outlet-id').value;
    const name = document.getElementById('outlet-name').value;
    const code = document.getElementById('outlet-code').value.toUpperCase();
    let branch_id = document.getElementById('outlet-branch').value;
    const address = document.getElementById('outlet-address').value;
    const phone = document.getElementById('outlet-phone').value;
    const tax_rate_percent = parseFloat(document.getElementById('outlet-tax').value) || 0;

    const profile = window.getCurrentProfile();
    if (profile?.role === 'kepala_cabang') {
        branch_id = profile.branch_id;
    }

    if (id) {
        const { error } = await supabase.from('outlets').update({ name, code, address, phone, branch_id, tax_rate_percent }).eq('id', id);
        if (error) showToast(error.message, 'error');
        else { showToast('Outlet diperbarui!', 'success'); document.getElementById('modal-outlet').classList.add('hidden'); loadOutlets(); }
    } else {
        const { error } = await supabase.from('outlets').insert([{ name, code, address, phone, branch_id, tax_rate_percent }]);
        if (error) showToast(error.message, 'error');
        else { showToast('Outlet ditambahkan!', 'success'); document.getElementById('modal-outlet').classList.add('hidden'); loadOutlets(); }
    }
}

export function editOutlet(id) {
    const o = outletsList.find(x => x.id === id);
    if (!o) return;
    document.getElementById('outlet-id').value = o.id;
    document.getElementById('outlet-name').value = o.name;
    document.getElementById('outlet-code').value = o.code || '';
    document.getElementById('outlet-branch').innerHTML = branchesList.map(b => `<option value="${b.id}" ${b.id===o.branch_id?'selected':''}>${b.name}</option>`).join('');
    document.getElementById('outlet-address').value = o.address || '';
    document.getElementById('outlet-phone').value = o.phone || '';
    document.getElementById('outlet-tax').value = o.tax_rate_percent || 0;
    document.getElementById('modal-outlet').classList.remove('hidden');
}

export async function deleteOutlet(id) {
    if(!confirm('Hapus outlet ini?')) return;
    
    const { count: txCount } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('outlet_id', id);
    if(txCount > 0) return showToast('Outlet tidak bisa dihapus karena sudah memiliki transaksi!', 'error');

    const { count: prodCount } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('outlet_id', id);
    if(prodCount > 0) return showToast('Outlet tidak bisa dihapus karena memiliki produk!', 'error');

    const { error } = await supabase.from('outlets').delete().eq('id', id);
    if(error) showToast(error.message, 'error');
    else loadOutlets();
}

export async function handleAddUser(e) {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const email = document.getElementById('user-email').value;
    const name = document.getElementById('user-name').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    const status = document.getElementById('user-status').value;
    let branch_id = null;
    let outlet_id = null;

    const profile = window.getCurrentProfile();

    if (role !== 'owner' && role !== 'superadmin') {
        branch_id = document.getElementById('user-branch').value;
    }
    if (role === 'kepala_toko' || role === 'kasir') {
        outlet_id = document.getElementById('user-outlet').value;
    }

    if (profile?.role === 'kepala_cabang') {
        branch_id = profile.branch_id;
    } else if (profile?.role === 'kepala_toko') {
        branch_id = profile.branch_id;
        outlet_id = profile.outlet_id;
    }

    const btn = document.getElementById('btn-save-user');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    if (id) {
        const { error } = await supabase.from('profiles').update({ name, role, branch_id, outlet_id, status }).eq('id', id);
        if (error) showToast('Gagal update: ' + error.message, 'error');
        else { showToast('Pegawai diperbarui!', 'success'); document.getElementById('modal-user').classList.add('hidden'); loadUsers(); }
        btn.disabled = false; btn.textContent = 'Simpan';
    } else {
        if (!password) {
            showToast('Password wajib diisi untuk pengguna baru', 'error');
            btn.disabled = false; btn.textContent = 'Simpan';
            return;
        }
        const { data: resData, error: invokeError } = await supabase.functions.invoke('create-user', {
            body: { email, password, name, role, branch_id, outlet_id, status }
        });

        if (invokeError) {
            showToast('Gagal memanggil fungsi: ' + invokeError.message, 'error');
            btn.disabled = false; btn.textContent = 'Simpan'; return;
        }

        if (resData && resData.error) {
            showToast('Gagal membuat user: ' + resData.error, 'error');
            btn.disabled = false; btn.textContent = 'Simpan'; return;
        }

        showToast('Pegawai berhasil ditambahkan!', 'success'); 
        document.getElementById('modal-user').classList.add('hidden'); 
        loadUsers();
        btn.disabled = false; btn.textContent = 'Simpan';
    }
}

export async function editUser(id) {
    const { data, error } = await supabase.from('profiles').select('id, name, email, role, branch_id, outlet_id, status').eq('id', id).single();
    if (error || !data) return showToast('Gagal memuat profil', 'error');
    
    document.getElementById('user-id').value = data.id;
    document.getElementById('user-email').value = data.email;
    document.getElementById('user-name').value = data.name || '';
    document.getElementById('user-email').disabled = true; 
    document.getElementById('user-password').value = ''; 
    document.getElementById('user-password').placeholder = '(Tidak bisa diubah dari sini)';
    document.getElementById('user-password').removeAttribute('required');
    
    document.getElementById('user-role').value = data.role;
    document.getElementById('user-status').value = data.status || 'active';
    let dataBranchId = data.branch_id;
    if (!dataBranchId && data.outlet_id) {
        const out = outletsList.find(o => o.id === data.outlet_id);
        if (out) dataBranchId = out.branch_id;
    }
    const initialBranch = dataBranchId || (branchesList.length > 0 ? branchesList[0].id : null);
    
    document.getElementById('user-branch').innerHTML = branchesList.map(b => `<option value="${b.id}" ${b.id===initialBranch?'selected':''}>${b.name}</option>`).join('');
    
    const filteredOutlets = outletsList.filter(o => o.branch_id === initialBranch);
    document.getElementById('user-outlet').innerHTML = filteredOutlets.map(o => `<option value="${o.id}" ${o.id===data.outlet_id?'selected':''}>${o.name}</option>`).join('');
    
    if (window.handleRoleSelectionChange) window.handleRoleSelectionChange();
    setTimeout(() => {
        document.getElementById('user-outlet').value = data.outlet_id || '';
    }, 50);
    document.getElementById('modal-user').classList.remove('hidden');
}

export async function deleteUser(id) {
    const profile = window.getCurrentProfile();
    if(id === profile?.id) return showToast('Tidak dapat menghapus diri sendiri', 'error');

    if(!confirm('Hapus pegawai ini? Aksesnya akan dicabut.')) return;
    
    const { count: txCount } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('cashier_id', id);
    if(txCount > 0) return showToast('User tidak bisa dihapus karena memiliki riwayat transaksi!', 'error');

    const { count: attCount } = await supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('profile_id', id);
    if(attCount > 0) return showToast('User tidak bisa dihapus karena memiliki riwayat absensi!', 'error');

    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if(error) showToast(error.message, 'error');
    else loadUsers();
}

window.loadSaAttendance = async function() {
    const tbody = document.querySelector('#sa-attendance-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Memuat data...</td></tr>';
    
    const outletFilter = document.getElementById('sa-attendance-outlet').value;
    const start = document.getElementById('sa-attendance-start').value;
    const end = document.getElementById('sa-attendance-end').value;
    
    if (!start || !end) return;

    let outletIdsToFetch = [];
    if (outletFilter && outletFilter !== 'all') {
        outletIdsToFetch = [outletFilter];
    } else {
        const profile = window.getCurrentProfile();
        if (profile?.role === 'kepala_cabang') {
            outletIdsToFetch = outletsList.filter(o => o.branch_id === profile.branch_id).map(o => o.id);
        } else if (profile?.role === 'kepala_toko') {
            outletIdsToFetch = [profile.outlet_id];
        } else {
            outletIdsToFetch = outletsList.map(o => o.id);
        }
    }
    
    let allRecords = [];
    const promises = outletIdsToFetch.map(oid => supabase.rpc('get_attendance_report', {
        p_start_date: start,
        p_end_date: end,
        p_outlet_id: oid
    }));
    
    const results = await Promise.all(promises);
    results.forEach((r, idx) => {
        if (r.data) {
            const outletName = outletsList.find(o => o.id === outletIdsToFetch[idx])?.name || '-';
            r.data.forEach(item => {
                item.outlet_name = outletName;
                allRecords.push(item);
            });
        }
    });
    
    allRecords.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.clock_in) - new Date(a.clock_in));
    
    tbody.innerHTML = '';
    if (allRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Tidak ada data absensi pada periode ini.</td></tr>';
        return;
    }
    
    allRecords.forEach(record => {
        const tr = document.createElement('tr');
        
        const dateStr = record.date ? new Date(record.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-';
        const inTime = record.clock_in ? new Date(record.clock_in).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-';
        const outTime = record.clock_out ? new Date(record.clock_out).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-';
        
        let statusBadge = '<span class="status-badge" style="background:#e5e7eb;color:#374151;">Tidak diketahui</span>';
        if (record.status === 'present') statusBadge = '<span class="status-badge" style="background:#d1fae5;color:#065f46;">Hadir</span>';
        else if (record.status === 'late') statusBadge = '<span class="status-badge" style="background:#fef3c7;color:#92400e;">Terlambat</span>';
        else if (record.status === 'absent') statusBadge = '<span class="status-badge" style="background:#fee2e2;color:#b91c1c;">Absen</span>';
        
        const photoHtml = record.check_in_photo ? `<a href="${record.check_in_photo}" target="_blank" style="color:var(--primary);text-decoration:underline;">Lihat</a>` : '-';
        
        tr.innerHTML = `
            <td><strong>${record.full_name || '-'}</strong></td>
            <td>${record.outlet_name}</td>
            <td>${dateStr}</td>
            <td>${inTime}</td>
            <td>${outTime}</td>
            <td>${statusBadge}</td>
            <td>${photoHtml}</td>
        `;
        tbody.appendChild(tr);
    });
};
