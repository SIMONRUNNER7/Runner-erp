import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useB2BCart } from './B2BCart';
import { portalApi } from '../../lib/b2bApi';
import { Minus, Plus, Trash2, ArrowLeft, CheckCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function B2BCartPage() {
  const { items, updateQty, removeItem, clear } = useB2BCart();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  async function handleOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) return;
    setError('');
    setLoading(true);
    try {
      await portalApi.createOrder({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, config: i.config })),
        notes,
        shippingAddress,
      });
      clear();
      qc.invalidateQueries({ queryKey: ['b2b-orders'] });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erreur lors de la commande');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <CheckCircle size={56} className="text-green-500" />
        <h2 className="text-xl font-bold text-gray-900">Commande envoyée !</h2>
        <p className="text-gray-500 max-w-sm">Votre commande a bien été reçue. Notre équipe vous contactera pour confirmer la livraison et les modalités de paiement.</p>
        <button onClick={() => navigate('/b2b/orders')} className="btn-primary px-6 py-2">Voir mes commandes</button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <p className="text-gray-400 text-lg">Votre panier est vide</p>
        <button onClick={() => navigate('/b2b/products')} className="btn-primary px-6 py-2 flex items-center gap-2">
          <ArrowLeft size={16} /> Retour au catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/b2b/products')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Mon panier</h1>
      </div>

      {/* Cart items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {items.map((item, idx) => (
          <div key={item.productId} className={`p-4 flex items-center gap-3 ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">{item.title}</p>
              <p className="text-xs text-gray-400">{item.sku} · {item.unitPrice.toFixed(2)} € / unité</p>
            </div>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="px-2 py-1.5 text-gray-500 hover:bg-gray-50">
                <Minus size={12} />
              </button>
              <span className="px-3 text-sm font-medium min-w-[2rem] text-center">{item.quantity}</span>
              <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="px-2 py-1.5 text-gray-500 hover:bg-gray-50">
                <Plus size={12} />
              </button>
            </div>
            <p className="text-sm font-semibold text-gray-900 w-16 text-right">{(item.quantity * item.unitPrice).toFixed(2)} €</p>
            <button onClick={() => removeItem(item.productId)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Total HT</span>
          <span className="text-lg font-bold text-gray-900">{total.toFixed(2)} €</span>
        </div>
      </div>

      {/* Order form */}
      <form onSubmit={handleOrder} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Informations de commande</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Adresse de livraison</label>
          <textarea
            className="input w-full resize-none"
            rows={2}
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            placeholder="Adresse complète de livraison…"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes / instructions</label>
          <textarea
            className="input w-full resize-none"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Instructions particulières, délai souhaité…"
          />
        </div>
        <p className="text-xs text-gray-400">Paiement : notre équipe vous contactera pour confirmer les modalités (carte, virement 30 jours, etc.).</p>
        <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-base disabled:opacity-50">
          {loading ? 'Envoi…' : `Commander — ${total.toFixed(2)} €`}
        </button>
      </form>
    </div>
  );
}
