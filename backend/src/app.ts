import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import routes from './routes';
import { sendApiDocsPage, sendOpenApiSpec } from './docs/apiDocs';

const app = express();

const isAllowedDevOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const port = Number(url.port);
    return isLocalHost && port >= 5173 && port <= 5199;
  } catch {
    return false;
  }
};

// ============================================
// Middlewares
// ============================================

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isVercelDomain = origin.endsWith('.vercel.app');

      if (
        env.corsOrigins.includes(origin) ||
        isVercelDomain ||
        (env.nodeEnv === 'development' && isAllowedDevOrigin(origin))
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP logger (chỉ hiện trong development)
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Handle favicon requests to prevent polluting terminal logs with 404 warnings
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// ============================================
// Routes
// ============================================
app.get('/api-docs', sendApiDocsPage);
app.get('/api/openapi.json', sendOpenApiSpec);
app.use('/api', routes);

// ============================================
// Error Handler (phải đặt cuối cùng)
// ============================================
app.use(errorHandler);

export default app;

// Final app boot registration check complete.
