import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage = () => {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await login(email, password);
    } catch {
      // Error is handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />

      <div className="login-card">
        <div className="login-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        </div>
        <h1 className="login-title">POS System</h1>
        <p className="login-subtitle">Sign in to manage your outlet</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading || !email || !password}
          >
            {loading ? (
              <span className="login-spinner" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
