import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Megaphone, RefreshCw, AlertTriangle } from 'lucide-react';
import { marketingApi } from '../lib/api';

/**
 * Onglet "Communication" : l'application marketing tourne comme un service
 * séparé (Python/FastAPI) et est affichée ici en iframe. L'ERP demande au
 * passage un lien de connexion signé, ce qui évite une seconde saisie de
 * mot de passe.
 *
 * Le jeton expirant en une minute, il n'est demandé qu'au moment de charger
 * l'iframe : on ne le conserve jamais dans l'état de l'application.
 */
export default function Communication() {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['marketing-status'],
    queryFn: () => marketingApi.status().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const openSession = async () => {
    setLoading(true);
    setLinkError(null);
    try {
      const { data } = await marketingApi.ssoUrl();
      setFrameSrc(data.url);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
          ?.message ??
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Impossible de contacter Communication.';
      setLinkError(message);
    } finally {
      setLoading(false);
    }
  };

  // Ouvre la session dès que l'on sait que l'app est configurée.
  useEffect(() => {
    if (status?.configured && !frameSrc) {
      openSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.configured]);

  const openInNewTab = async () => {
    // Safari bloque une fenêtre ouverte après un appel réseau : on ouvre
    // l'onglet immédiatement, puis on y injecte l'URL une fois le jeton reçu.
    const tab = window.open('', '_blank', 'noopener');
    try {
      const { data } = await marketingApi.ssoUrl();
      if (tab) tab.location.href = data.url;
    } catch {
      tab?.close();
      setLinkError("Impossible d'ouvrir Communication dans un nouvel onglet.");
    }
  };

  if (statusLoading) {
    return <div className="text-sm text-gray-500">Chargement…</div>;
  }

  if (!status?.configured) {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Megaphone className="text-red-600" size={22} />
          <h1 className="text-xl font-semibold text-gray-900">Communication</h1>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-orange-800">
            <p className="font-medium">L'application Communication n'est pas encore déployée.</p>
            <p className="mt-1">
              Une fois le service en ligne, renseignez <code>MARKETING_APP_URL</code> et{' '}
              <code>MARKETING_SSO_SECRET</code> dans le fichier <code>.env</code> du serveur, puis
              redémarrez l'ERP. Voir <code>marketing/DEPLOY.md</code> dans le dépôt.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex items-center gap-3 mb-3">
        <Megaphone className="text-red-600" size={22} />
        <h1 className="text-xl font-semibold text-gray-900">Communication</h1>
        <div className="flex-1" />
        <button
          onClick={openSession}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="Recharger Communication"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Recharger
        </button>
        <button
          onClick={openInNewTab}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ExternalLink size={15} />
          Ouvrir en plein écran
        </button>
      </div>

      {linkError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-sm text-red-700">
          {linkError}
        </div>
      )}

      {frameSrc ? (
        <iframe
          ref={iframeRef}
          src={frameSrc}
          title="Communication"
          className="flex-1 w-full rounded-lg border border-gray-200 bg-white"
        />
      ) : (
        !linkError && <div className="text-sm text-gray-500">Connexion à Communication…</div>
      )}
    </div>
  );
}
