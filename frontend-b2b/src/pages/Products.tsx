import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from '../lib/api';
import { useCartStore } from '../store/cart.store';
import { useB2BStore } from '../store/b2b.store';
import { ShoppingCart, Plus, Minus, Check, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

interface B2BProduct {
  id: string;
  title: string;
  sku: string;
  description?: string;
  b2bPrice: number;
  finalPrice: number;
  clientDiscount: number;
  imageUrl?: string;
}

export default function Products() {
  const { client } = useB2BStore();
  const { addItem, items } = useCartStore();
  const navigate = useNavigate();
  const [added, setAdded] = useState<string | null>(null);
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const { data: products = [], isLoading } = useQuery<B2BProduct[]>({
    queryKey: ['b2b-products'],
    queryFn: () => portalApi.products().then((r) => r.data),
  });

  const getQty = (id: string) => qtys[id] ?? 1;
  const setQty = (id: string, v: number) => setQtys((q) => ({ ...q, [id]: Math.max(1, v) }));

  function handleAdd(product: B2BProduct) {
    addItem({ productId: product.id, title: product.title, sku: product.sku, quantity: getQty(product.id), unitPrice: product.finalPrice });
    setAdded(product.id);
    setTimeout(() => setAdded(null), 1500);
  }

  const cartCount = items.reduce((s, i) => s + i.quantity, 0);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 aspect-square animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Catalogue</h1>
          {client && client.discount > 0 ? (
            <p className="text-sm text-green-600 mt-0.5 font-medium">
              Votre remise exclusive : −{client.discount}% sur tous les produits
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-0.5">Prix professionnels exclusifs</p>
          )}
        </div>
        {cartCount > 0 && (
          <button onClick={() => navigate('/cart')} className="btn-primary flex items-center gap-2">
            <ShoppingCart size={16} />
            Panier ({cartCount})
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Package size={48} className="text-gray-200" />
          <p className="text-gray-400">Aucun produit disponible pour le moment</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => {
            const isAdded = added === product.id;
            return (
              <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                {/* Image */}
                <div className="aspect-square bg-gray-100 overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={32} className="text-gray-300" />
                    </div>
                  )}
                </div>

                <div className="p-3 flex flex-col flex-1 gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{product.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{product.sku}</p>
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-gray-900">{product.finalPrice.toFixed(2)} €</span>
                    {product.clientDiscount > 0 && (
                      <>
                        <span className="text-xs text-gray-400 line-through">{product.b2bPrice.toFixed(2)} €</span>
                        <span className="bg-green-100 text-green-700 text-xs font-medium px-1.5 py-0.5 rounded ml-auto">−{product.clientDiscount}%</span>
                      </>
                    )}
                  </div>

                  {/* Qty + add */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button onClick={() => setQty(product.id, getQty(product.id) - 1)} className="px-2 py-1.5 text-gray-500 hover:bg-gray-50">
                        <Minus size={12} />
                      </button>
                      <span className="px-2 text-sm font-medium min-w-[1.5rem] text-center">{getQty(product.id)}</span>
                      <button onClick={() => setQty(product.id, getQty(product.id) + 1)} className="px-2 py-1.5 text-gray-500 hover:bg-gray-50">
                        <Plus size={12} />
                      </button>
                    </div>
                    <button
                      onClick={() => handleAdd(product)}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all',
                        isAdded ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-black'
                      )}
                    >
                      {isAdded ? <><Check size={13} /> Ajouté</> : <><ShoppingCart size={13} /> Ajouter</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
