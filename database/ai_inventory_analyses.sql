-- AI Inventory Analysis history
-- Run once in Supabase SQL editor before using AI báo cáo kho.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ai_inventory_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  days INTEGER NOT NULL CHECK (days > 0 AND days <= 365),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  total_products INTEGER NOT NULL DEFAULT 0,
  out_of_stock_count INTEGER NOT NULL DEFAULT 0,
  low_stock_count INTEGER NOT NULL DEFAULT 0,
  safe_count INTEGER NOT NULL DEFAULT 0,
  total_stock_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_retail_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
  estimated_restock_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  analysis JSONB NOT NULL,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_inventory_analyses_generated_at
  ON ai_inventory_analyses(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_inventory_analyses_period
  ON ai_inventory_analyses(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_ai_inventory_analyses_generated_by
  ON ai_inventory_analyses(generated_by);

ALTER TABLE public.ai_inventory_analyses ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_ai_inventory_analyses_updated_at ON ai_inventory_analyses;
CREATE TRIGGER update_ai_inventory_analyses_updated_at
BEFORE UPDATE ON ai_inventory_analyses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
