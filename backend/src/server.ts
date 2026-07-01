import app from './app';
import { env } from './config/env';
import { supabase } from './config/supabase';
import { NotificationService } from './services/notification.service';

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

  // Đăng ký Supabase Realtime để lắng nghe các dòng log kiểm toán (audit_logs) mới được thêm vào
  supabase
    .channel('audit-logs-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'audit_logs' },
      (payload) => {
        console.log('[Realtime] New audit log entry detected:', payload.new);
        NotificationService.sendAuditLogNotification(payload.new).catch((err) => {
          console.error('[Realtime Audit Log Error]', err);
        });
      }
    )
    .subscribe((status) => {
      console.log(`[Realtime] Supabase Realtime subscription status: ${status}`);
    });
});

// Export cho Vercel serverless
export default app;
