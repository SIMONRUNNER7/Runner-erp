import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import routes from './routes/index';
import { initSyncWorker } from './workers/sync.worker';
import { initAlertsWorker } from './workers/alerts.worker';
import logger from './lib/logger';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .concat(['http://localhost:5173', 'http://localhost:5174']);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
};

export const io = new Server(httpServer, {
  cors: corsOptions,
});

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (msg: string) => logger.info(msg.trim()) },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-room', (room: string) => {
    socket.join(room);
    logger.info(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    // Initialize background workers
    initSyncWorker();
    initAlertsWorker();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
