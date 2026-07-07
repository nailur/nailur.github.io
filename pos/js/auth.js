import { supabase } from './supabase.js';
import { showToast } from './app.js';

let currentUser = null;
let currentProfile = null;

export async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        
        let needsRefresh = true;
        const cachedStr = localStorage.getItem('pos_profile');
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                if (cached._timestamp && (Date.now() - cached._timestamp < 15 * 60 * 1000)) {
                    currentProfile = cached;
                    needsRefresh = false;
                }
            } catch(e) { /* ignore JSON parse error */ }
        }
        
        if (needsRefresh) {
            await loadProfile(currentUser.id);
        }
        
        if (currentProfile && currentProfile.status === 'inactive') {
            await supabase.auth.signOut();
            currentUser = null;
            currentProfile = null;
            localStorage.removeItem('pos_profile');
            return null; // Force logout
        }
        
        if (window.OneSignalDeferred) {
            window.OneSignalDeferred.push(function(OneSignal) {
                OneSignal.login(currentUser.id);
                OneSignal.User.addTag("app", "pos");
                if (OneSignal.Notifications.permission !== "granted") {
                    OneSignal.Slidedown.promptPush();
                }
                OneSignal.User.PushSubscription.optIn();
            });
        }

        return { user: currentUser, profile: currentProfile };
    }
    return null;
}

export async function loadProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, branch_id, outlet_id, status, created_at, outlets(name, address)')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error("Error loading profile:", error);
        return null;
    }
    currentProfile = data;
    currentProfile._timestamp = Date.now();
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

    if (window.OneSignalDeferred) {
        window.OneSignalDeferred.push(function(OneSignal) {
            OneSignal.login(currentUser.id);
            OneSignal.User.addTag("app", "pos");
            if (OneSignal.Notifications.permission !== "granted") {
                OneSignal.Slidedown.promptPush();
            }
            OneSignal.User.PushSubscription.optIn();
        });
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
        if (window.OneSignalDeferred) {
            window.OneSignalDeferred.push(function(OneSignal) {
                OneSignal.logout();
            });
        }
        window.location.reload();
    }
}

export function getCurrentUser() {
    return currentUser;
}

export function getCurrentProfile() {
    return currentProfile;
}
