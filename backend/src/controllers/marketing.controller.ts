import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

/**
 * Onglet "Communication" : l'app marketing (Runner Golf Communication) tourne
 * comme un service séparé, avec sa propre base et sa propre session. Plutôt que
 * de demander une deuxième connexion, l'ERP signe ici un ticket d'entrée à usage
 * immédiat que l'app marketing sait vérifier (secret partagé, HS256).
 *
 * Le jeton ne transporte que l'identité et le rôle, et expire en une minute :
 * il sert uniquement à ouvrir la session, jamais à autoriser des appels API.
 */

const TOKEN_AUDIENCE = 'communication';
const TOKEN_TTL_SECONDS = 60;

/** Rôles ERP autorisés à ouvrir l'onglet Communication. */
export const MARKETING_ROLES = ['president', 'commercial'] as const;

export const getSsoUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const appUrl = (process.env.MARKETING_APP_URL || '').replace(/\/+$/, '');
    const secret = process.env.MARKETING_SSO_SECRET;

    if (!appUrl || !secret) {
      res.status(503).json({
        error: 'Communication is not configured',
        message:
          "L'application Communication n'est pas encore configurée. Renseignez " +
          'MARKETING_APP_URL et MARKETING_SSO_SECRET dans le fichier .env du serveur.',
      });
      return;
    }

    const user = req.user!;
    const token = jwt.sign(
      { email: user.email, name: user.name, role: user.role },
      secret,
      {
        subject: user.id,
        audience: TOKEN_AUDIENCE,
        expiresIn: TOKEN_TTL_SECONDS,
      } as jwt.SignOptions
    );

    res.json({
      url: `${appUrl}/sso?token=${encodeURIComponent(token)}`,
      appUrl,
      expiresIn: TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    logger.error('Marketing SSO url error:', error);
    res.status(500).json({ error: 'Failed to build Communication session link' });
  }
};

/**
 * Permet au front d'afficher un message utile (« pas encore déployé ») sans
 * générer de jeton ni déclencher une erreur dans la console.
 */
export const getStatus = async (_req: AuthRequest, res: Response): Promise<void> => {
  const appUrl = (process.env.MARKETING_APP_URL || '').replace(/\/+$/, '');
  res.json({
    configured: Boolean(appUrl && process.env.MARKETING_SSO_SECRET),
    appUrl: appUrl || null,
  });
};
