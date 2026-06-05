import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

// Validate biến môi trường bắt buộc
if (!process.env.JWT_SECRET && nodeEnv === 'production') {
  throw new Error('❌ JWT_SECRET is required in production environment');
}

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-fallback-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '10h',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
