/**
 * users.js — Account & Staff Management UI Module
 * Contains: filterUserOutlets, handleRoleSelectionChange, loadTargetUsers
 * Registered to window for access from HTML and management.js
 */
import { supabase } from './supabase.js';
import { getCurrentProfile } from './auth.js';
import { outletsList, branchesList } from './state.js';

// Filter outlet list based on branch & currently logged-in user role
function filterUserOutlets() {
    const branchId = document.getElementById('user-branch').value;
    const myRole = getCurrentProfile()?.role;
    let filteredOutlets = outletsList;

    if (myRole === 'kepala_cabang') {
        filteredOutlets = outletsList.filter(o => o.branch_id === getCurrentProfile().branch_id);
    } else if (branchId) {
        filteredOutlets = outletsList.filter(o => o.branch_id === branchId);
    }

    document.getElementById('user-outlet').innerHTML = filteredOutlets
        .map(o => `<option value="${o.id}">${o.name}</option>`)
        .join('');
}

// Show/hide Branch & Outlet fields based on selected role in form
function handleRoleSelectionChange() {
    const role = document.getElementById('user-role').value;
    const branchGroup = document.getElementById('group-user-branch');
    const outletGroup = document.getElementById('group-user-outlet');
    const shiftGroup = document.getElementById('group-user-shift');
    const myRole = getCurrentProfile()?.role;

    if (role === 'owner' || role === 'superadmin') {
        branchGroup.classList.add('hidden');
        outletGroup.classList.add('hidden');
        if (shiftGroup) shiftGroup.classList.add('hidden');
    } else if (role === 'kepala_cabang') {
        if (myRole === 'superadmin' || myRole === 'owner') branchGroup.classList.remove('hidden');
        else branchGroup.classList.add('hidden');
        outletGroup.classList.add('hidden');
        if (shiftGroup) shiftGroup.classList.add('hidden');
    } else {
        if (myRole === 'superadmin' || myRole === 'owner') branchGroup.classList.remove('hidden');
        else branchGroup.classList.add('hidden');
        // Store heads cannot change outlet
        if (myRole === 'kepala_toko') outletGroup.classList.add('hidden');
        else outletGroup.classList.remove('hidden');

        if (window.populateShiftOptions) window.populateShiftOptions(document.getElementById('user-outlet').value);
    }

    filterUserOutlets();
}

// Populate announcement target user dropdown (Superadmin only)
async function loadTargetUsers() {
    const select = document.getElementById('announcement-target');
    if (!select) return;

    const { data: users, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .neq('role', 'superadmin');

    if (users && !error) {
        select.innerHTML = '<option value="all">Semua Kasir</option>';
        users.forEach(u => {
            const name = u.name || u.email;
            select.innerHTML += `<option value="${u.id}">${name}</option>`;
        });
    }
}

// Register to window for inline HTML onclick & other modules
window.filterUserOutlets = filterUserOutlets;
window.handleRoleSelectionChange = handleRoleSelectionChange;
window.loadTargetUsers = loadTargetUsers;

