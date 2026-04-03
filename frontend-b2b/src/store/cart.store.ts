import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  title: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQty: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (newItem) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === newItem.productId);
          if (existing) {
            return { items: state.items.map((i) => i.productId === newItem.productId ? { ...i, quantity: i.quantity + newItem.quantity } : i) };
          }
          return { items: [...state.items, newItem] };
        }),
      updateQty: (productId, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((i) => i.productId !== productId)
            : state.items.map((i) => i.productId === productId ? { ...i, quantity } : i),
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'b2b-cart' }
  )
);
