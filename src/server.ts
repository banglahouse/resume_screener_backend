import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { AppDataSource } from './config/data-source';
import { env } from './config/env';
import { authContext } from './middleware/authContext.middleware';
import { errorMiddleware, notFoundHandler } from './middleware/error.middleware';
import { recruiterRoutes } from './models/recruiter/recruiter.routes';
import { candidateRoutes } from './models/candidate/candidate.routes';
import { logger } from './utils/logger';

async function createApp() {
  const app = express();

  // Basic middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth context middleware
  app.use('/api', authContext);

  // Routes
  app.use('/api', recruiterRoutes);
  app.use('/api', candidateRoutes);

  // Error handling
  app.use('*', notFoundHandler);
  app.use(errorMiddleware);

  return app;
}

async function startServer() {
  try {
    // Initialize database connection
    logger.info('Initializing database connection...');
    await AppDataSource.initialize();
    logger.info('Database connected successfully');

    // Create and start server
    const app = await createApp();
    
    app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info('=== Resume Matcher Backend Started ===');
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

// Start the server
if (require.main === module) {
  startServer();
}
