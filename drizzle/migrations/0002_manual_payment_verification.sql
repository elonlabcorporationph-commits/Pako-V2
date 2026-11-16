ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_verification';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_screenshot_path text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT 'JIS Company';