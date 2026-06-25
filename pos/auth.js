import { supabase } from './supabase.js';
import { showToast } from './app.js';

let currentUser = null;
let currentProfile = null;

export async function checkSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadProfile(currentUser.id);
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
    return { user: currentUser, profile: currentProfile };
}

export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        showToast(error.message, 'error');
    }
    currentUser = null;
    currentProfile = null;
    window.location.reload();
}

export function getCurrentUser() {
    return currentUser;
}

export function getCurrentProfile() {
    return currentProfile;
}
