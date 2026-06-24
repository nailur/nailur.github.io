import type { Product } from '../types';

interface ProductCatalogProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

export const ProductCatalog = ({ products, onAddToCart }: ProductCatalogProps) => {
  const categories = Array.from(new Set(products.map(p => p.category)));

  return (
    <div className="catalog">
      <h2>Products</h2>
      {categories.map(category => (
        <div key={category} className="category">
          <h3>{category}</h3>
          <div className="products-grid">
            {products
              .filter(p => p.category === category)
              .map(product => (
                <button
                  key={product.id}
                  className="product-card"
                  onClick={() => onAddToCart(product)}
                >
                  <div className="product-name">{product.name}</div>
                  <div className="product-price">${product.price.toFixed(2)}</div>
                  <div className="add-btn">+ Add</div>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};
