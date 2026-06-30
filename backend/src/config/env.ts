import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isLocalDevelopment = nodeEnv === 'development' || nodeEnv === 'test';

if (!process.env.JWT_SECRET && !isLocalDevelopment) {
  throw new Error('JWT_SECRET is required outside local development');
}

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  isLocalDevelopment,
  jwtSecret: isLocalDevelopment ? (process.env.JWT_SECRET || 'dev-only-fallback-secret') : process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '10h',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'Sora POS <noreply@sorapos.com>',
  payosClientId: process.env.PAYOS_CLIENT_ID || '',
  payosApiKey: process.env.PAYOS_API_KEY || '',
  payosChecksumKey: process.env.PAYOS_CHECKSUM_KEY || '',
};
