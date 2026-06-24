import type { Transaction } from '../types';

interface SalesHistoryProps {
  transactions: Transaction[];
  onClearHistory: () => void;
}

export const SalesHistory = ({ transactions, onClearHistory }: SalesHistoryProps) => {
  if (transactions.length === 0) {
    return (
      <div className="sales-history">
        <h2>Sales History</h2>
        <p>No transactions yet</p>
      </div>
    );
  }

  const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="sales-history">
      <div className="history-header">
        <h2>Sales History</h2>
        <button onClick={onClearHistory} className="clear-btn">
          Clear History
        </button>
      </div>

      <div className="history-stats">
        <div className="stat">
          <strong>{transactions.length}</strong> Transactions
        </div>
        <div className="stat">
          <strong>${totalSales.toFixed(2)}</strong> Total Sales
        </div>
      </div>

      <table className="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Items</th>
            <th>Subtotal</th>
            <th>Tax</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(transaction => (
            <tr key={transaction.id}>
              <td>{new Date(transaction.timestamp).toLocaleString()}</td>
              <td>{transaction.items.length}</td>
              <td>${transaction.subtotal.toFixed(2)}</td>
              <td>${transaction.tax.toFixed(2)}</td>
              <td>${transaction.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
