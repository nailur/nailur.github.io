/**
 * DOMPETKU GLOBAL STATE STORE
 */

const state = {
    user: null,
    profile: null,
    wallets: [],
    categories: [],
    transactions: [],
    budgets: [],
    filters: {
        type: 'all',          // 'all', 'expense', 'income', 'transfer'
        walletId: 'all',      // 'all' or uuid
        categoryId: 'all',    // 'all' or uuid
        dateRange: 'month',   // 'today', 'week', 'month', 'year', 'custom'
        startDate: '',
        endDate: '',
        searchQuery: ''
    },
    activeTab: 'dashboard',   // 'dashboard', 'transactions', 'wallets', 'budgets', 'categories', 'reports', 'settings'
    listeners: new Map()
};

export function getState() {
    return state;
}

export function setState(key, value) {
    state[key] = value;
    notify(key, value);
}

export function updateFilters(newFilters) {
    state.filters = { ...state.filters, ...newFilters };
    notify('filters', state.filters);
}

export function subscribe(key, callback) {
    if (!state.listeners.has(key)) {
        state.listeners.set(key, new Set());
    }
    state.listeners.get(key).add(callback);
    return () => state.listeners.get(key).delete(callback);
}

function notify(key, value) {
    if (state.listeners.has(key)) {
        state.listeners.get(key).forEach(cb => {
            try {
                cb(value, state);
            } catch (err) {
                console.error(`Error in state listener for ${key}:`, err);
            }
        });
    }
    // Also notify global wildcard listeners
    if (state.listeners.has('*')) {
        state.listeners.get('*').forEach(cb => {
            try {
                cb(key, value, state);
            } catch (err) {
                console.error(`Error in wildcard state listener:`, err);
            }
        });
    }
}

