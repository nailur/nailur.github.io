import { useState, useEffect } from 'react';
import { sampleProducts, TAX_RATE } from './data';
import type { CartItem, Transaction, Product } from './types';
import { loadTransactions, saveTransaction, deleteAllTransactions, subscribeToTransactions } from './storage';
import { ProductCatalog } from './components/ProductCatalog';
import { Cart } from './components/Cart';
import { Checkout } from './components/Checkout';
import { SalesHistory } from './components/SalesHistory';
import './App.css';

function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'sale' | 'history'>('sale');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initTransactions = async () => {
      const data = await loadTransactions();
      setTransactions(data);
      setLoading(false);
    };

    initTransactions();

    const unsubscribe = subscribeToTransactions((updated) => {
      setTransactions(updated);
    });

    return () => unsubscribe();
  }, []);

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
    const transaction: Transaction = {
      id: Date.now().toString(),
      items: [...cart],
      subtotal,
      tax,
      total,
      timestamp: Date.now(),
    };

    try {
      await saveTransaction(transaction);
      setCart([]);
      alert(`Sale completed! Total: $${total.toFixed(2)}`);
    } catch (error) {
      alert('Failed to save transaction. Please try again.');
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Clear all transaction history? This cannot be undone.')) {
      try {
        await deleteAllTransactions();
        setTransactions([]);
      } catch (error) {
        alert('Failed to clear history. Please try again.');
      }
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Simple POS System</h1>
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'sale' ? 'active' : ''}`}
            onClick={() => setActiveTab('sale')}
          >
            Sale
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>
      </header>

      <div className="container">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <p>Loading...</p>
          </div>
        ) : activeTab === 'sale' ? (
          <div className="sale-layout">
            <div className="products-section">
              <ProductCatalog
                products={sampleProducts}
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
        ) : (
          <SalesHistory
            transactions={transactions}
            onClearHistory={handleClearHistory}
          />
        )}
      </div>
    </div>
  );
}

export default App;
