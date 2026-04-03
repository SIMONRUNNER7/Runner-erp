import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from '../../lib/b2bApi';
import { useB2BCart } from './B2BCart';
import { useB2BStore } from '../../store/b2b.store';
import { ShoppingCart, Plus, Minus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface B2BProduct {
  id: string;
  title: string;
  sku: string;
  description?: string;
  b2bPrice: number;
  finalPrice: number;
  clientDiscount: number;
  imageUrl?: string;
  options?: Record<string, string[]>;
}

export default function B2BProducts() {
  const { client } = useB2BStore();
  const { addItem, items } = useB2BCart();
  const navigate = useNavigate();
  const [added, setAdded] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { data: products = [], isLoading } = useQuery<B2BProduct[]>({
    queryKey: ['b2b-products'],
    queryFn: () => portalApi.products().then((r) => r.data),
  });

  function getQty(id: string) { return quantities[id] ?? 1; }
  function setQty(id: string, v: number) { setQuantities((q) => ({ ...q, [id]: Math.max(1, v) })); }

  function handleAdd(product: B2BProduct) {
    addItem({ productId: product.id, title: product.title, sku: product.sku, quantity: getQty(product.id), unitPrice: product.finalPrice });
    setAdded(product.id);
    setTimeout(() => setAdded(null), 1500);
  }

  const cartCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Catalogue B2B</h1>
          {client && client.discount > 0 ? (
            <p className="text-sm text-green-600 mt-0.5 font-medium">Votre remise : −{client.discount}% appliquée automatiquement</p>
          ) : (
            <p className="text-sm text-gray-500 mt-0.5">Prix B2B exclusifs</p>
          )}
        </div>
        {cartCount > 0 && (
          <button
            onClick={() => navigate('/b2b/cart')}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black transition-colors"
          >
            <ShoppingCart size={16} />
            Voir le panier ({cartCount})
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Aucun produit disponible pour le moment</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const isAdded = added === product.id;
            const hasDiscount = product.clientDiscount > 0;
            return (
              <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Product image */}
                <div className="aspect-square bg-gray-100 overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingCart size={40} />
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-gray-900 leading-tight">{product.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{product.sku}</p>
                    {product.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>}
                  </div>

                  {/* Price */}
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-bold text-gray-900">{product.finalPrice.toFixed(2)} €</span>
                    {hasDiscount && (
                      <span className="text-sm text-gray-400 line-through">{product.b2bPrice.toFixed(2)} €</span>
                    )}
                    {hasDiscount && (
                      <span className="ml-auto bg-green-100 text-green-700 text-xs font-medium px-1.5 py-0.5 rounded">−{product.clientDiscount}%</span>
                    )}
                  </div>

                  {/* Qty + add */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setQty(product.id, getQty(product.id) - 1)}
                        className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="px-3 text-sm font-medium text-gray-900 min-w-[2rem] text-center">{getQty(product.id)}</span>
                      <button
                        onClick={() => setQty(product.id, getQty(product.id) + 1)}
                        className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => handleAdd(product)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isAdded ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-black'
                      }`}
                    >
                      {isAdded ? <><Check size={15} /> Ajouté</> : <><ShoppingCart size={15} /> Ajouter</>}
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
