alter table public.pay_orders add column ip_hash text;
create index pay_orders_ip_hash_created_idx on public.pay_orders (ip_hash, created_at);