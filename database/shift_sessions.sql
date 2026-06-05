-- Shift sessions for cashier day/shift control.
-- Run this after the base schema in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS shift_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opened_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_name VARCHAR(80),
  shift_code VARCHAR(16) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'opened', -- opened, checked_in, closed, cancelled
  opening_cash DECIMAL(15, 2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(15, 2),
  expected_cash DECIMAL(15, 2),
  cash_difference DECIMAL(15, 2),
  note TEXT,
  manager_note TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shift_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shift_sessions_employee_id ON shift_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_opened_by ON shift_sessions(opened_by);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_shift_date ON shift_sessions(shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_status ON shift_sessions(status);
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders(shift_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_sessions_employee_active
  ON shift_sessions(employee_id)
  WHERE status IN ('opened', 'checked_in');

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_sessions_code_per_day
  ON shift_sessions(shift_date, shift_code)
  WHERE status IN ('opened', 'checked_in');

DROP TRIGGER IF EXISTS update_shift_sessions_updated_at ON shift_sessions;
CREATE TRIGGER update_shift_sessions_updated_at
  BEFORE UPDATE ON shift_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
