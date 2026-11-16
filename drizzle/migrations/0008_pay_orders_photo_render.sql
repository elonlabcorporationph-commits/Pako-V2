ALTER TABLE public.pay_orders
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS template text,
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS result_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS render_status text NOT NULL DEFAULT 'none';