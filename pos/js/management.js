import { supabase } from './supabase.js';
import { showToast } from './app.js';
import { 
    branchesList, outletsList, 
    setBranchesList, setOutletsList 
} from './state.js';
import { loadShifts, openShiftModal } from './shift-master.js';

export async function initManagement() {
    const profile = window.getCurrentProfile();
    const role = profile?.role;
    
    // ====== ROLE-BASED TAB ACCESS ======
    // Role matrix:
    // superadmin: ALL tabs
    // owner: all except server-info & announcement
    // kepala_cabang: outlets, users, shifts, stock, expenses, deposits, analytics (no branches, server-info, announcement)
    // kepala_toko: users, shifts, stock, expenses (add only), deposits (add only), (no branches, outlets, analytics, server-info, announcement)
    // kasir: NO access to management at all (button hidden)
    
    const tabMap = {
        'branches-tab': { roles: ['superadmin', 'owner'] },
        'outlets-tab': { roles: ['superadmin', 'owner', 'kepala_cabang'] },
        'users-tab': { roles: ['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'] },
        'shifts-tab': { roles: ['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'] },
        'stock-tab-content': { roles: ['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'] },
        'expenses-tab-content': { roles: ['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'] },
        'deposits-tab-content': { roles: ['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'] },
        'expenses-master-tab': { roles: ['superadmin', 'owner', 'kepala_cabang'] },
        'analytics-tab': { roles: ['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'] },
        'server-info-tab': { roles: ['superadmin'] },
        'announcement-tab': { roles: ['superadmin'] },
    };
    
    // Show/hide tabs based on role
    Object.entries(tabMap).forEach(([tabId, config]) => {
        const btn = document.querySelector(`.tab-btn[data-target="${tabId}"]`);
        if (btn) {
            if (config.roles.includes(role)) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        }
    });
    
    // Set management title based on role
    const titleEl = document.getElementById('management-title');
    if (titleEl) {
        if (role === 'superadmin') titleEl.textContent = 'Manajemen Sistem (Superadmin)';
        else if (role === 'owner') titleEl.textContent = 'Manajemen Sistem';
        else if (role === 'kepala_cabang') titleEl.textContent = 'Panel Kepala Cabang';
        else if (role === 'kepala_toko') titleEl.textContent = 'Panel Kepala Toko';
    }
    
    // ====== ROLE-BASED ACTION BUTTON VISIBILITY ======
    // Branches: only owner can add/edit/delete (superadmin too)
    // Already handled by tab visibility + buttons are always shown within the tab
    
    // Shifts: kepala_toko cannot delete
    // Stock: kepala_toko cannot delete
    // Deposits: kepala_toko can only add (no edit/delete)
    // Users: kepala_toko can add+edit but not delete
    
    // Store role globally for use in render functions
    window._managementRole = role;
    
    // ====== TAB RESTORE LOGIC ======
    const savedMgmtTab = localStorage.getItem('management_active_tab');
    let tabToClick = null;
    
    if (savedMgmtTab) {
        const btn = document.querySelector(`.tab-btn[data-target="${savedMgmtTab}"]`);
        if (btn && !btn.classList.contains('hidden')) {
            tabToClick = btn;
        }
    }
    
    if (!tabToClick) {
        // Find first visible tab
        const allTabs = document.querySelectorAll('#sa-tabs-container .tab-btn');
        for (const btn of allTabs) {
            if (!btn.classList.contains('hidden')) {
                tabToClick = btn;
                break;
            }
        }
    }
    
    if (tabToClick) {
        tabToClick.click();
    } else {
        loadUsers();
    }
    
    // ====== LOAD DATA ======
    loadShifts();
    
    // Bind shift button
    const btnAddShift = document.getElementById('btn-add-shift');
    if (btnAddShift && !btnAddShift.hasAttribute('data-bound')) {
        btnAddShift.addEventListener('click', () => openShiftModal());
        btnAddShift.setAttribute('data-bound', 'true');
    }

    if (['superadmin', 'owner', 'kepala_cabang'].includes(role)) {
        await loadBranches();
        await loadOutlets();
    }
    await loadUsers();
    
    // Load inventory, expenses, deposits data when tabs are accessible
    if (['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'].includes(role)) {
        // These are loaded via app.js initPos, but we also need them in management
        if (window.loadInventoryForManagement) window.loadInventoryForManagement();
        if (window.loadExpensesForManagement) window.loadExpensesForManagement();
        if (window.loadDepositsForManagement) window.loadDepositsForManagement();
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
        const role = window._managementRole;
        const canEdit = ['superadmin', 'owner', 'kepala_cabang', 'kepala_toko'].includes(role);
        const canDelete = ['superadmin', 'owner', 'kepala_cabang'].includes(role);
        tbody.innerHTML = data.map(u => `
            <tr>
                <td>${u.name || '-'}</td>
                <td>${u.email}</td>
                <td><span class="user-badge">${u.role}</span></td>
                <td>${u.branches?.name || '-'}</td>
                <td>${u.outlets?.name || '-'}</td>
                <td>${u.status === 'inactive' ? '<span class="user-badge" style="background:var(--danger)">Inactive</span>' : '<span class="user-badge" style="background:var(--success)">Active</span>'}</td>
                <td>
                    ${canEdit ? `<button class="btn btn-icon" style="color:var(--primary)" onclick="editUser('${u.id}')"><i class="ph ph-pencil-simple"></i></button>` : ''}
                    ${canDelete ? `<button class="btn btn-icon" onclick="deleteUser('${u.id}')"><i class="ph ph-trash"></i></button>` : ''}
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
    let shift_id = document.getElementById('user-shift').value || null;

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
        const { error } = await supabase.from('profiles').update({ name, role, branch_id, outlet_id, status, shift_id }).eq('id', id);
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

        if (shift_id && resData && resData.user) {
            await supabase.from('profiles').update({ shift_id }).eq('id', resData.user.id);
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
    if (filteredOutlets.length > 0) {
        document.getElementById('user-outlet').innerHTML = '<option value="">-- Pilih Outlet --</option>' + filteredOutlets.map(o => `<option value="${o.id}" ${o.id===data.outlet_id?'selected':''}>${o.name}</option>`).join('');
    } else {
        document.getElementById('user-outlet').innerHTML = '<option value="">-- Pilih Outlet --</option>';
    }

    if (data.outlet_id) {
        populateShiftOptions(data.outlet_id, data.shift_id);
    } else {
        document.getElementById('group-user-shift').classList.add('hidden');
    }

    if (window.handleRoleSelectionChange) window.handleRoleSelectionChange();
    setTimeout(() => {
        document.getElementById('user-outlet').value = data.outlet_id || '';
        document.getElementById('user-shift').value = data.shift_id || '';
    }, 50);
    document.getElementById('modal-user').classList.remove('hidden');
}

export async function populateShiftOptions(outletId, selectedShiftId = null) {
    const shiftGroup = document.getElementById('group-user-shift');
    const shiftSelect = document.getElementById('user-shift');
    if (!outletId) {
        shiftGroup.classList.add('hidden');
        return;
    }

    const { data } = await supabase.from('shifts').select('id, name, start_time, end_time').eq('outlet_id', outletId);
    if (data && data.length > 0) {
        let opts = '<option value="">-- Pilih Shift (Opsional) --</option>';
        data.forEach(s => {
            const isSel = (s.id === selectedShiftId) ? 'selected' : '';
            const tStart = s.start_time ? s.start_time.slice(0,5) : '';
            const tEnd = s.end_time ? s.end_time.slice(0,5) : '';
            opts += '<option value="' + s.id + '" ' + isSel + '>' + s.name + ' (' + tStart + ' - ' + tEnd + ')</option>';
        });
        shiftSelect.innerHTML = opts;
        shiftGroup.classList.remove('hidden');
    } else {
        shiftSelect.innerHTML = '<option value="">-- Belum Ada Shift Master --</option>';
        shiftGroup.classList.remove('hidden');
    }
}

document.getElementById('user-outlet')?.addEventListener('change', (e) => {
    populateShiftOptions(e.target.value);
});

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
