-- Persist external payment provider intents such as PayOS.
-- Run after database/schema.sql.

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_code bigint UNIQUE NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  description text,
  provider text NOT NULL DEFAULT 'payos',
  payment_link_id text,
  checkout_url text,
  qr_code text,
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  webhook_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_status
  ON public.payment_intents(status);

CREATE INDEX IF NOT EXISTS idx_payment_intents_created_at
  ON public.payment_intents(created_at DESC);

DROP TRIGGER IF EXISTS update_payment_intents_updated_at ON public.payment_intents;
CREATE TRIGGER update_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
