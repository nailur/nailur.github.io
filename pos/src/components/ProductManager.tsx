import { useState } from 'react';
import type { Product } from '../types';
import { addProduct, updateProduct, deleteProduct } from '../data';

interface ProductManagerProps {
  products: Product[];
  outletId: string;
}

export const ProductManager = ({ products, outletId }: ProductManagerProps) => {
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ name: '', price: '', category: 'Beverages' });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const resetForm = () => {
    setFormData({ name: '', price: '', category: 'Beverages' });
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: formData.name,
          price: parseFloat(formData.price),
          category: formData.category,
        });
      } else {
        await addProduct({
          name: formData.name,
          price: parseFloat(formData.price),
          category: formData.category,
          outlet_id: outletId,
        }, outletId);
      }
      resetForm();
    } catch {
      alert('Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      category: product.category,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this product?')) {
      try {
        await deleteProduct(id);
      } catch {
        alert('Failed to delete product');
      }
    }
  };

  const categories = Array.from(new Set(products.map(p => p.category))).sort();
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="product-manager">
      <div className="manager-header">
        <div>
          <h2>Product Management</h2>
          <p className="manager-subtitle">{products.length} product{products.length !== 1 ? 's' : ''} in catalog</p>
        </div>
        <button
          onClick={() => { showForm ? resetForm() : setShowForm(true); }}
          className={`action-btn ${showForm ? 'action-btn-cancel' : 'action-btn-primary'}`}
        >
          {showForm ? '✕ Cancel' : '+ Add Product'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="manager-form">
          <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="product-name">Product Name *</label>
              <input
                id="product-name"
                type="text"
                placeholder="e.g. Cappuccino"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="product-price">Price *</label>
              <input
                id="product-price"
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="product-category">Category *</label>
              <select
                id="product-category"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                <option>Beverages</option>
                <option>Pastries</option>
                <option>Food</option>
                <option>Other</option>
                {categories.filter(c => !['Beverages', 'Pastries', 'Food', 'Other'].includes(c)).map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" onClick={resetForm} className="action-btn action-btn-ghost">Cancel</button>
            <button type="submit" className="action-btn action-btn-primary" disabled={loading || !formData.name || !formData.price}>
              {loading ? 'Saving...' : (editingProduct ? 'Update Product' : 'Add Product')}
            </button>
          </div>
        </form>
      )}

      {products.length > 0 && (
        <div className="search-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      <div className="products-table-wrap">
        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <p>{searchTerm ? 'No products match your search.' : 'No products yet. Add your first product above.'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id}>
                  <td>
                    <span className="product-table-name">{product.name}</span>
                  </td>
                  <td>
                    <span className="category-badge">{product.category}</span>
                  </td>
                  <td className="price-cell">${product.price.toFixed(2)}</td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => handleEdit(product)} className="icon-btn" title="Edit">✏️</button>
                      <button onClick={() => handleDelete(product.id)} className="icon-btn icon-btn-danger" title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
