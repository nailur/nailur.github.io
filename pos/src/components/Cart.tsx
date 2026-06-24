import type { CartItem } from '../types';

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  subtotal: number;
}

export const Cart = ({ items, onUpdateQuantity, onRemoveItem, subtotal }: CartProps) => {
  if (items.length === 0) {
    return <div className="cart"><p>Cart is empty</p></div>;
  }

  return (
    <div className="cart">
      <h2>Shopping Cart</h2>
      <table className="cart-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.product.id}>
              <td>{item.product.name}</td>
              <td>${item.product.price.toFixed(2)}</td>
              <td>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => onUpdateQuantity(item.product.id, parseInt(e.target.value))}
                  className="qty-input"
                />
              </td>
              <td>${(item.product.price * item.quantity).toFixed(2)}</td>
              <td>
                <button
                  onClick={() => onRemoveItem(item.product.id)}
                  className="remove-btn"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cart-summary">
        <strong>Subtotal: ${subtotal.toFixed(2)}</strong>
      </div>
    </div>
  );
};
