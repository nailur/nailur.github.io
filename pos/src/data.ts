import type { Product } from './types';

export const sampleProducts: Product[] = [
  { id: '1', name: 'Coffee', price: 3.50, category: 'Beverages' },
  { id: '2', name: 'Espresso', price: 2.50, category: 'Beverages' },
  { id: '3', name: 'Cappuccino', price: 4.00, category: 'Beverages' },
  { id: '4', name: 'Croissant', price: 3.00, category: 'Pastries' },
  { id: '5', name: 'Donut', price: 2.00, category: 'Pastries' },
  { id: '6', name: 'Muffin', price: 2.75, category: 'Pastries' },
  { id: '7', name: 'Sandwich', price: 6.50, category: 'Food' },
  { id: '8', name: 'Salad', price: 7.50, category: 'Food' },
  { id: '9', name: 'Juice', price: 3.00, category: 'Beverages' },
  { id: '10', name: 'Water', price: 1.50, category: 'Beverages' },
];

export const TAX_RATE = 0.08;
