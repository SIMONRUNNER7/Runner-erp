import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { portalApi } from '../lib/api';
import { useB2BStore } from '../store/b2b.store';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useB2BStore((s) => s.setAuth);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', company: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await portalApi.login(form.email, form.password);
      setAuth(res.data.token, res.data.client);
      navigate('/products');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await portalApi.register(form);
      setSuccess('Demande envoyée ! Vous recevrez un email de confirmation dans les 48h.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  }

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="https://cdn.shopify.com/s/files/1/0705/1218/1334/files/THE_RUNNER-LOGOS-BLACK_copie.png?v=1772531379"
            alt="Runner Golf"
            className="h-10 mx-auto mb-3"
          />
          <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">Espace revendeurs</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setSuccess(''); }}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                  tab === t ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t === 'login' ? 'Connexion' : 'Demande d\'accès'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
                {success}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input type="email" required className="input" value={form.email} onChange={f('email')} placeholder="contact@votre-boutique.fr" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Mot de passe</label>
                  <input type="password" required className="input" value={form.password} onChange={f('password')} placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading} className="w-full btn-primary py-2.5">
                  {loading ? 'Connexion…' : 'Se connecter'}
                </button>
              </form>
            ) : success ? null : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Société *</label>
                  <input required className="input" value={form.company} onChange={f('company')} placeholder="Ma Boutique Golf" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Votre nom *</label>
                  <input required className="input" value={form.name} onChange={f('name')} placeholder="Jean Dupont" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                  <input type="email" required className="input" value={form.email} onChange={f('email')} placeholder="contact@boutique.fr" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Téléphone</label>
                  <input className="input" value={form.phone} onChange={f('phone')} placeholder="+33 6 12 34 56 78" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Mot de passe *</label>
                  <input type="password" required autoComplete="new-password" className="input" value={form.password} onChange={f('password')} placeholder="Min. 8 caractères" />
                </div>
                <p className="text-xs text-gray-400 pt-1">Votre demande sera examinée dans les 48h.</p>
                <button type="submit" disabled={loading} className="w-full btn-primary py-2.5">
                  {loading ? 'Envoi…' : 'Envoyer la demande'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-gray-400">
          <a href="https://runner.golf" className="hover:text-gray-600 transition-colors">runner.golf</a>
          {' · '}Réservé aux revendeurs agréés
        </p>
      </div>
    </div>
  );
}
