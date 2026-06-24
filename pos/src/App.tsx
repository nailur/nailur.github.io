import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { loadProducts, subscribeToProducts, TAX_RATE } from './data';
import type { CartItem, Transaction, Product } from './types';
import { loadTransactions, saveTransaction, deleteAllTransactions, subscribeToTransactions } from './storage';
import { ProductCatalog } from './components/ProductCatalog';
import { Cart } from './components/Cart';
import { Checkout } from './components/Checkout';
import { SalesHistory } from './components/SalesHistory';
import { ProductManager } from './components/ProductManager';
import { OutletManager } from './components/OutletManager';
import { UserManager } from './components/UserManager';
import { LoginPage } from './components/LoginPage';
import './App.css';

type TabId = 'sale' | 'history' | 'products' | 'outlets' | 'users';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
  superadminOnly?: boolean;
}

const TABS: TabDef[] = [
  { id: 'sale', label: 'Sale', icon: '🛒' },
  { id: 'history', label: 'History', icon: '📊' },
  { id: 'products', label: 'Products', icon: '📦' },
  { id: 'outlets', label: 'Outlets', icon: '🏪', superadminOnly: true },
  { id: 'users', label: 'Users', icon: '👥', superadminOnly: true },
];

function PosApp() {
  const { user, logout } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('sale');
  const [loading, setLoading] = useState(true);

  const outletId = user?.outletId || '';
  const isSuperadmin = user?.role === 'superadmin';

  useEffect(() => {
    if (!user) return;

    const initData = async () => {
      const [productsData, transactionsData] = await Promise.all([
        loadProducts(outletId || undefined),
        loadTransactions(outletId || undefined),
      ]);
      setProducts(productsData);
      setTransactions(transactionsData);
      setLoading(false);
    };

    initData();

    const unsubscribeProducts = subscribeToProducts((updated) => {
      setProducts(updated);
    }, outletId || undefined);

    const unsubscribeTransactions = subscribeToTransactions((updated) => {
      setTransactions(updated);
    }, outletId || undefined);

    return () => {
      unsubscribeProducts();
      unsubscribeTransactions();
    };
  }, [user, outletId]);

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setCart(prev =>
        prev.map(item =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const handleRemoveItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleCheckout = async () => {
    if (!outletId && !isSuperadmin) {
      alert('No outlet assigned. Contact your superadmin.');
      return;
    }

    const transaction: Transaction = {
      id: Date.now().toString(),
      items: [...cart],
      subtotal,
      tax,
      total,
      timestamp: Date.now(),
      outlet_id: outletId,
    };

    try {
      await saveTransaction(transaction);
      setCart([]);
      alert(`Sale completed! Total: $${total.toFixed(2)}`);
    } catch {
      alert('Failed to save transaction. Please try again.');
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Clear all transaction history? This cannot be undone.')) {
      try {
        await deleteAllTransactions(outletId || undefined);
        setTransactions([]);
      } catch {
        alert('Failed to clear history. Please try again.');
      }
    }
  };

  const visibleTabs = TABS.filter(tab => isSuperadmin || !tab.superadminOnly);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading data...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'sale':
        return (
          <div className="sale-layout">
            <div className="products-section">
              <ProductCatalog
                products={products}
                onAddToCart={handleAddToCart}
              />
            </div>
            <div className="right-section">
              <Cart
                items={cart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                subtotal={subtotal}
              />
              <Checkout
                items={cart}
                subtotal={subtotal}
                tax={tax}
                total={total}
                onCheckout={handleCheckout}
              />
            </div>
          </div>
        );
      case 'history':
        return (
          <SalesHistory
            transactions={transactions}
            onClearHistory={handleClearHistory}
          />
        );
      case 'products':
        return (
          <ProductManager
            products={products}
            outletId={outletId}
          />
        );
      case 'outlets':
        return isSuperadmin ? <OutletManager /> : null;
      case 'users':
        return isSuperadmin ? <UserManager /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="header-brand">
            <svg className="header-logo" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            <div>
              <h1>POS System</h1>
              {user?.outletName && (
                <span className="header-outlet">{user.outletName}</span>
              )}
            </div>
          </div>
          <div className="header-user">
            <div className="header-user-info">
              <span className="header-email">{user?.email}</span>
              <span className={`header-role ${user?.role === 'superadmin' ? 'role-super' : 'role-admin'}`}>
                {user?.role}
              </span>
            </div>
            <button onClick={logout} className="logout-btn" title="Sign out">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
        <nav className="tabs">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="container">
        {renderContent()}
      </div>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Initializing...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <PosApp />;
}

function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWrapper;
