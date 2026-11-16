create type public.pay_status as enum ('pending','verified','rejected');
create table public.pay_methods (
  method text primary key, label text not null, account_name text, account_number text, qr_path text,
  active boolean not null default true, sort int not null default 0);
create table public.pay_orders (
  id uuid primary key default gen_random_uuid(), code text unique not null, package_name text not null,
  amount int not null check (amount in (99,149)), method text not null references public.pay_methods(method),
  customer_name text not null check (char_length(customer_name) between 2 and 60),
  contact text not null check (char_length(contact) between 7 and 80),
  reference text not null check (reference ~ '^[0-9]{8,20}$'), proof_path text,
  status public.pay_status not null default 'pending', note text, reviewed_at timestamptz,
  created_at timestamptz not null default now(), unique (method, reference));
create table public.pay_order_events (
  id bigint generated always as identity primary key, order_id uuid references public.pay_orders(id) on delete cascade,
  actor text not null default 'staff', from_status public.pay_status, to_status public.pay_status, note text,
  created_at timestamptz not null default now());
grant all on public.pay_methods, public.pay_orders, public.pay_order_events to service_role;
alter table public.pay_methods enable row level security;
alter table public.pay_orders enable row level security;
alter table public.pay_order_events enable row level security;
insert into public.pay_methods (method,label,sort) values ('gcash','GCash',1),('maya','Maya',2),('other','Other / Bank',3);