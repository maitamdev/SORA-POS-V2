-- Sora POS - Email nhận lịch ca và tổng thời gian làm thực tế
-- Chạy một lần trong Supabase SQL Editor trước khi dùng tính năng mới.

BEGIN;

-- users.email hiện đang là mã đăng nhập tự sinh (thường là 6 chữ số),
-- nên không dùng lại cột đó để gửi email lịch ca.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);

UPDATE public.users
SET notification_email = NULLIF(lower(trim(notification_email)), '')
WHERE notification_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_notification_email_unique_idx
  ON public.users (lower(notification_email))
  WHERE notification_email IS NOT NULL AND btrim(notification_email) <> '';

ALTER TABLE public.shift_sessions
  ADD COLUMN IF NOT EXISTS total_work_minutes INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shift_sessions_total_work_minutes_check'
  ) THEN
    ALTER TABLE public.shift_sessions
      ADD CONSTRAINT shift_sessions_total_work_minutes_check
      CHECK (total_work_minutes IS NULL OR total_work_minutes >= 0);
  END IF;
END $$;

-- Backfill ca đã chốt; ca chưa nhận thì tổng giờ làm là 0.
UPDATE public.shift_sessions
SET total_work_minutes = CASE
  WHEN COALESCE(started_at, checked_in_at) IS NULL THEN 0
  ELSE GREATEST(
    0,
    ROUND(EXTRACT(EPOCH FROM (closed_at - COALESCE(started_at, checked_in_at))) / 60)::INTEGER
  )
END
WHERE closed_at IS NOT NULL AND total_work_minutes IS NULL;

COMMIT;
