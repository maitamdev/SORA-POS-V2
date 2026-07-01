-- Store AI revenue analysis history.
-- Run this once in Supabase SQL editor before using the saved-analysis feature.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ai_revenue_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  days INTEGER NOT NULL CHECK (days > 0 AND days <= 365),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  total_revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_cogs DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_profit DECIMAL(15, 2) NOT NULL DEFAULT 0,
  profit_margin DECIMAL(8, 2) NOT NULL DEFAULT 0,
  average_order_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
  analysis JSONB NOT NULL,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_revenue_analyses_generated_at ON ai_revenue_analyses(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_revenue_analyses_period ON ai_revenue_analyses(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_ai_revenue_analyses_generated_by ON ai_revenue_analyses(generated_by);

ALTER TABLE public.ai_revenue_analyses ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_ai_revenue_analyses_updated_at ON ai_revenue_analyses;
CREATE TRIGGER update_ai_revenue_analyses_updated_at
BEFORE UPDATE ON ai_revenue_analyses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
