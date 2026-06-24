import { useState, useEffect } from 'react';
import type { UserRole, Outlet } from '../types';
import { loadUsers, createUserWithRole, removeUserRole, subscribeToUserRoles } from '../users';
import { loadOutlets } from '../outlets';

export const UserManager = () => {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'admin' as 'superadmin' | 'admin',
    outletId: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const [usersData, outletsData] = await Promise.all([
        loadUsers(),
        loadOutlets(),
      ]);
      setUsers(usersData);
      setOutlets(outletsData);
    };

    init();

    const unsubscribe = subscribeToUserRoles((updated) => {
      setUsers(updated);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({ email: '', password: '', role: 'admin', outletId: '' });
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;
    if (formData.role === 'admin' && !formData.outletId) {
      alert('Please select an outlet for the admin');
      return;
    }

    setLoading(true);
    try {
      await createUserWithRole(
        formData.email,
        formData.password,
        formData.role,
        formData.role === 'superadmin' ? null : formData.outletId
      );
      resetForm();
      // Refresh users list
      const updated = await loadUsers();
      setUsers(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (roleId: string) => {
    if (!window.confirm('Remove this user role? The user account will remain but lose access.')) return;
    try {
      await removeUserRole(roleId);
    } catch {
      alert('Failed to remove user role');
    }
  };

  const getOutletName = (outletId: string | null) => {
    if (!outletId) return '—';
    const outlet = outlets.find(o => o.id === outletId);
    return outlet?.name || 'Unknown';
  };

  const superadmins = users.filter(u => u.role === 'superadmin');
  const admins = users.filter(u => u.role === 'admin');

  return (
    <div className="user-manager">
      <div className="manager-header">
        <div>
          <h2>User Management</h2>
          <p className="manager-subtitle">{users.length} user{users.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={() => { showForm ? resetForm() : setShowForm(true); }}
          className={`action-btn ${showForm ? 'action-btn-cancel' : 'action-btn-primary'}`}
        >
          {showForm ? '✕ Cancel' : '+ New User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <h3>Create New User</h3>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="user-email">Email *</label>
              <input
                id="user-email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="user-password">Password *</label>
              <input
                id="user-password"
                type="password"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div className="form-field">
              <label htmlFor="user-role">Role *</label>
              <select
                id="user-role"
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value as 'superadmin' | 'admin' })}
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
            {formData.role === 'admin' && (
              <div className="form-field">
                <label htmlFor="user-outlet">Assign to Outlet *</label>
                <select
                  id="user-outlet"
                  value={formData.outletId}
                  onChange={e => setFormData({ ...formData, outletId: e.target.value })}
                  required
                >
                  <option value="">Select outlet...</option>
                  {outlets.filter(o => o.is_active).map(outlet => (
                    <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="form-actions">
            <button type="button" onClick={resetForm} className="action-btn action-btn-ghost">Cancel</button>
            <button type="submit" className="action-btn action-btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      {superadmins.length > 0 && (
        <div className="user-section">
          <h3 className="user-section-title">
            <span className="role-badge role-badge-super">Superadmins</span>
            <span className="user-section-count">{superadmins.length}</span>
          </h3>
          <div className="user-list">
            {superadmins.map(user => (
              <div key={user.id} className="user-row">
                <div className="user-info">
                  <div className="user-avatar">
                    {(user.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="user-email">{user.email || 'Unknown'}</p>
                    <p className="user-meta">Superadmin · All outlets</p>
                  </div>
                </div>
                <button onClick={() => handleRemove(user.id)} className="icon-btn icon-btn-danger" title="Remove role">
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {admins.length > 0 && (
        <div className="user-section">
          <h3 className="user-section-title">
            <span className="role-badge role-badge-admin">Admins</span>
            <span className="user-section-count">{admins.length}</span>
          </h3>
          <div className="user-list">
            {admins.map(user => (
              <div key={user.id} className="user-row">
                <div className="user-info">
                  <div className="user-avatar user-avatar-admin">
                    {(user.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="user-email">{user.email || 'Unknown'}</p>
                    <p className="user-meta">Admin · {getOutletName(user.outlet_id)}</p>
                  </div>
                </div>
                <button onClick={() => handleRemove(user.id)} className="icon-btn icon-btn-danger" title="Remove role">
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {users.length === 0 && !showForm && (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <p>No users yet. Create an admin account to manage an outlet.</p>
        </div>
      )}
    </div>
  );
};
