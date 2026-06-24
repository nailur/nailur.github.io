import type { CartItem } from '../types';

interface CheckoutProps {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  onCheckout: () => void;
}

export const Checkout = ({ items, subtotal, tax, total, onCheckout }: CheckoutProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="checkout">
      <h2>Checkout</h2>
      <div className="checkout-summary">
        <div className="summary-row">
          <span>Subtotal:</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Tax (8%):</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="summary-row total">
          <span>Total:</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>
      <button onClick={onCheckout} className="checkout-btn">
        Complete Sale
      </button>
    </div>
  );
};
