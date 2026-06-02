import app from './app';
import { env } from './config/env';

const PORT = env.port;

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║          🏪 Sora POS API Server          ║
  ╠═══════════════════════════════════════════╣
  ║  Status:  ✅ Running                      ║
  ║  Port:    ${String(PORT).padEnd(33)}║
  ║  Env:     ${env.nodeEnv.padEnd(33)}║
  ║  API:     http://localhost:${PORT}/api       ║
  ║  Health:  http://localhost:${PORT}/api/health ║
  ╚═══════════════════════════════════════════╝
  `);
});

// Export cho Vercel serverless
export default app;
