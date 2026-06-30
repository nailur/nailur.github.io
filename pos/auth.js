import { supabase } from './supabase.js';
import { showToast } from './app.js';

let currentUser = null;
let currentProfile = null;

export async function checkSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        
        // Cek apakah ada profil di localStorage (hemat database query)
        const cachedProfile = localStorage.getItem('pos_profile');
        if (cachedProfile) {
            currentProfile = JSON.parse(cachedProfile);
        } else {
            await loadProfile(currentUser.id);
        }
        
        if (currentProfile && currentProfile.status === 'inactive') {
            await supabase.auth.signOut();
            currentUser = null;
            currentProfile = null;
            localStorage.removeItem('pos_profile');
            return null; // Force logout
        }

        return { user: currentUser, profile: currentProfile };
    }
    return null;
}

export async function loadProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*, outlets(name, address)')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error("Error loading profile:", error);
        return null;
    }
    currentProfile = data;
    localStorage.setItem('pos_profile', JSON.stringify(currentProfile)); // Cache ke localStorage
    return currentProfile;
}

export async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    
    if (error) {
        showToast(error.message, 'error');
        return null;
    }
    
    currentUser = data.user;
    await loadProfile(currentUser.id);

    if (currentProfile && currentProfile.status === 'inactive') {
        showToast('Akun Anda telah dinonaktifkan', 'error');
        await supabase.auth.signOut();
        currentUser = null;
        currentProfile = null;
        localStorage.removeItem('pos_profile');
        return null;
    }

    return { user: currentUser, profile: currentProfile };
}

export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        showToast(error.message, 'error');
    } else {
        currentUser = null;
        currentProfile = null;
        localStorage.removeItem('pos_profile');
        window.location.reload();
    }
}

export function getCurrentUser() {
    return currentUser;
}

export function getCurrentProfile() {
    return currentProfile;
}
