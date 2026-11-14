import app from './app.js';
import { env } from './config/env.js';
import { db } from './config/database.js';
import { logger } from './config/logger.js';
import { schedulerWorker } from './services/outreach/schedulerWorker.js';
import { imapSyncService } from './services/outreach/imapSyncService.js';

const PORT = env.PORT || 5000;

async function startServer() {
  logger.info(`Starting LeadGen AI backend server in ${env.NODE_ENV} mode...`);

  // Start listening immediately
  const server = app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
    logger.info(`API Health endpoint: http://localhost:${PORT}/api/health`);
  });

  // Attempt database connection asynchronously
  db.connect().then((dbConnected) => {
    if (dbConnected) {
      logger.info('Database connected successfully on startup.');
      schedulerWorker.start();
      imapSyncService.startPolling(60000); // Poll IMAP inbox every 60 seconds
    } else {
      logger.warn('Initial MongoDB connection failed. Server will continue with background reconnection.');
    }
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      schedulerWorker.stop();
      imapSyncService.stopPolling();
      await db.disconnect();
      logger.info('Closed all remaining connections. Exiting process.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((err) => {
  logger.error('Fatal server boot failure', err);
  process.exit(1);
});
