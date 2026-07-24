create table if not exists public.portfolio_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.portfolio_content (
  locale text not null check (locale in ('en', 'vi')),
  page text not null check (page in ('home', 'projects')),
  translations jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (locale, page)
);

alter table public.portfolio_admins enable row level security;
alter table public.portfolio_content enable row level security;

create or replace function public.is_portfolio_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portfolio_admins
    where email = auth.jwt() ->> 'email'
  );
$$;

drop policy if exists "Public can read portfolio content" on public.portfolio_content;
create policy "Public can read portfolio content"
on public.portfolio_content
for select
using (true);

drop policy if exists "Portfolio admins can insert content" on public.portfolio_content;
create policy "Portfolio admins can insert content"
on public.portfolio_content
for insert
to authenticated
with check (public.is_portfolio_admin());

drop policy if exists "Portfolio admins can update content" on public.portfolio_content;
create policy "Portfolio admins can update content"
on public.portfolio_content
for update
to authenticated
using (public.is_portfolio_admin())
with check (public.is_portfolio_admin());

drop policy if exists "Portfolio admins can delete content" on public.portfolio_content;
create policy "Portfolio admins can delete content"
on public.portfolio_content
for delete
to authenticated
using (public.is_portfolio_admin());

drop trigger if exists set_portfolio_content_updated_at on public.portfolio_content;
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_portfolio_content_updated_at
before update on public.portfolio_content
for each row
execute function public.set_updated_at();

-- After creating your Supabase Auth user, add your admin email here:
-- insert into public.portfolio_admins (email) values ('your-email@example.com');
