import express, { Express, Request, Response, NextFunction } from 'express';
import scanRoutes from './routes/scan';
import analyzeRoutes from './routes/analyze';

/**
 * Create and configure Express application
 * Sets up middleware and routes
 */
export function createApp(): Express {
  const app = express();

  // Middleware: Parse JSON request bodies
  app.use(express.json());

  // Middleware: Request logging (basic)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/scan', scanRoutes);
  app.use('/analyze', analyzeRoutes);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}
