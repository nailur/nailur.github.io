import { useState, useEffect } from 'react';
import type { Outlet } from '../types';
import { loadOutlets, createOutlet, updateOutlet, deleteOutlet, getOutletStats, subscribeToOutlets } from '../outlets';

interface OutletStats {
  productCount: number;
  transactionCount: number;
  totalSales: number;
}

export const OutletManager = () => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [stats, setStats] = useState<Record<string, OutletStats>>({});
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', phone: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const data = await loadOutlets();
      setOutlets(data);

      // Load stats for each outlet
      const statsMap: Record<string, OutletStats> = {};
      for (const outlet of data) {
        statsMap[outlet.id] = await getOutletStats(outlet.id);
      }
      setStats(statsMap);
    };

    init();

    const unsubscribe = subscribeToOutlets(async (updated) => {
      setOutlets(updated);
      const statsMap: Record<string, OutletStats> = {};
      for (const outlet of updated) {
        statsMap[outlet.id] = await getOutletStats(outlet.id);
      }
      setStats(statsMap);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFormData({ name: '', address: '', phone: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      if (editingId) {
        await updateOutlet(editingId, formData);
      } else {
        await createOutlet(formData);
      }
      resetForm();
    } catch {
      alert('Failed to save outlet');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (outlet: Outlet) => {
    setEditingId(outlet.id);
    setFormData({
      name: outlet.name,
      address: outlet.address || '',
      phone: outlet.phone || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this outlet? All its products and transactions will be lost.')) return;
    try {
      await deleteOutlet(id);
    } catch {
      alert('Failed to delete outlet');
    }
  };

  const handleToggleActive = async (outlet: Outlet) => {
    try {
      await updateOutlet(outlet.id, { is_active: !outlet.is_active });
    } catch {
      alert('Failed to update outlet');
    }
  };

  return (
    <div className="outlet-manager">
      <div className="manager-header">
        <div>
          <h2>Outlet Management</h2>
          <p className="manager-subtitle">{outlets.length} outlet{outlets.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={() => { showForm ? resetForm() : setShowForm(true); }}
          className={`action-btn ${showForm ? 'action-btn-cancel' : 'action-btn-primary'}`}
        >
          {showForm ? '✕ Cancel' : '+ New Outlet'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <h3>{editingId ? 'Edit Outlet' : 'Create New Outlet'}</h3>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="outlet-name">Outlet Name *</label>
              <input
                id="outlet-name"
                type="text"
                placeholder="e.g. Downtown Branch"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="outlet-phone">Phone</label>
              <input
                id="outlet-phone"
                type="tel"
                placeholder="e.g. +62 812 3456 7890"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="form-field form-field-full">
              <label htmlFor="outlet-address">Address</label>
              <input
                id="outlet-address"
                type="text"
                placeholder="e.g. Jl. Sudirman No. 123, Jakarta"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" onClick={resetForm} className="action-btn action-btn-ghost">Cancel</button>
            <button type="submit" className="action-btn action-btn-primary" disabled={loading || !formData.name.trim()}>
              {loading ? 'Saving...' : (editingId ? 'Update Outlet' : 'Create Outlet')}
            </button>
          </div>
        </form>
      )}

      <div className="outlet-grid">
        {outlets.map(outlet => {
          const s = stats[outlet.id] || { productCount: 0, transactionCount: 0, totalSales: 0 };
          return (
            <div key={outlet.id} className={`outlet-card ${!outlet.is_active ? 'outlet-card-inactive' : ''}`}>
              <div className="outlet-card-header">
                <div className="outlet-card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div className="outlet-card-actions">
                  <button onClick={() => handleToggleActive(outlet)} className="icon-btn" title={outlet.is_active ? 'Deactivate' : 'Activate'}>
                    {outlet.is_active ? '🟢' : '🔴'}
                  </button>
                  <button onClick={() => handleEdit(outlet)} className="icon-btn" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(outlet.id)} className="icon-btn icon-btn-danger" title="Delete">🗑️</button>
                </div>
              </div>
              <h3 className="outlet-card-name">{outlet.name}</h3>
              {outlet.address && <p className="outlet-card-address">{outlet.address}</p>}
              {outlet.phone && <p className="outlet-card-phone">📞 {outlet.phone}</p>}
              {!outlet.is_active && <span className="outlet-badge-inactive">Inactive</span>}
              <div className="outlet-card-stats">
                <div className="outlet-stat">
                  <span className="outlet-stat-value">{s.productCount}</span>
                  <span className="outlet-stat-label">Products</span>
                </div>
                <div className="outlet-stat">
                  <span className="outlet-stat-value">{s.transactionCount}</span>
                  <span className="outlet-stat-label">Sales</span>
                </div>
                <div className="outlet-stat">
                  <span className="outlet-stat-value">${s.totalSales.toFixed(0)}</span>
                  <span className="outlet-stat-label">Revenue</span>
                </div>
              </div>
            </div>
          );
        })}

        {outlets.length === 0 && (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <p>No outlets yet. Create your first outlet to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};
