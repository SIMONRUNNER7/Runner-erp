import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '../store/cart.store';
import { portalApi } from '../lib/api';
import { Minus, Plus, Trash2, ArrowLeft, CheckCircle, ShoppingBag } from 'lucide-react';

export default function Cart() {
  const { items, updateQty, removeItem, clear } = useCartStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const orderMutation = useMutation({
    mutationFn: () => portalApi.createOrder({ items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })), notes, shippingAddress }),
    onSuccess: () => {
      clear();
      qc.invalidateQueries({ queryKey: ['b2b-orders'] });
      setSuccess(true);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erreur lors de la commande');
    },
  });

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
        <CheckCircle size={60} className="text-green-500" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Commande envoyée !</h2>
          <p className="text-gray-500 mt-2 max-w-sm">Votre commande a bien été reçue. Notre équipe vous contactera pour confirmer les détails.</p>
        </div>
        <button onClick={() => navigate('/orders')} className="btn-primary">Voir mes commandes</button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
        <ShoppingBag size={56} className="text-gray-200" />
        <p className="text-gray-400 text-lg font-medium">Votre panier est vide</p>
        <button onClick={() => navigate('/products')} className="btn-primary flex items-center gap-2">
          <ArrowLeft size={16} /> Voir le catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/products')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Mon panier</h1>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {items.map((item, idx) => (
          <div key={item.productId} className={`flex items-center gap-3 px-4 py-3.5 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>
              <p className="text-xs text-gray-400">{item.sku} · {item.unitPrice.toFixed(2)} € / u</p>
            </div>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shrink-0">
              <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="px-2 py-1.5 text-gray-500 hover:bg-gray-50">
                <Minus size={11} />
              </button>
              <span className="px-2.5 text-sm font-medium min-w-[2rem] text-center">{item.quantity}</span>
              <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="px-2 py-1.5 text-gray-500 hover:bg-gray-50">
                <Plus size={11} />
              </button>
            </div>
            <p className="text-sm font-semibold text-gray-900 w-14 text-right shrink-0">{(item.quantity * item.unitPrice).toFixed(2)} €</p>
            <button onClick={() => removeItem(item.productId)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-700">Total HT</span>
          <span className="text-lg font-bold text-gray-900">{total.toFixed(2)} €</span>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); orderMutation.mutate(); }}
        className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
      >
        <h2 className="font-semibold text-gray-900">Informations de livraison</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Adresse de livraison</label>
          <textarea
            className="input resize-none"
            rows={2}
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            placeholder="Adresse complète de livraison…"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes / instructions</label>
          <textarea
            className="input resize-none"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Instructions particulières, délai souhaité…"
          />
        </div>
        <p className="text-xs text-gray-400">
          Notre équipe vous contactera pour confirmer les modalités de paiement (carte, virement à 30 jours, etc.).
        </p>
        <button
          type="submit"
          disabled={orderMutation.isPending}
          className="w-full btn-primary py-3 text-base disabled:opacity-50"
        >
          {orderMutation.isPending ? 'Envoi en cours…' : `Commander — ${total.toFixed(2)} €`}
        </button>
      </form>
    </div>
  );
}
