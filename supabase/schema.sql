-- ============================================================
-- FLEX DRIVE — Banco de dados (Supabase / PostgreSQL)
-- Rode este script no painel do Supabase:  SQL Editor → New query → Run
-- Ele cria as tabelas, a segurança (RLS) e os buckets de arquivos.
-- ============================================================

-- ── PERFIS (liga-se ao Supabase Auth) ──────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'cliente' check (role in ('empresa','cliente')),
  full_name   text,
  email       text,
  phone       text,
  cpf         text,
  city        text,
  created_at  timestamptz default now()
);

-- ── VEÍCULOS ───────────────────────────────────────────────
create table if not exists public.vehicles (
  id            uuid primary key default gen_random_uuid(),
  plate         text not null,
  brand         text,
  model         text,
  year          int,
  color         text,
  renavam       text,
  km            int default 0,
  status        text not null default 'disponivel' check (status in ('locado','disponivel','manutencao')),
  client_id     uuid references public.profiles(id) on delete set null,
  weekly_value  numeric(10,2) default 0,
  next_revision date,
  created_at    timestamptz default now()
);

-- ── PAGAMENTOS ─────────────────────────────────────────────
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.profiles(id) on delete cascade,
  vehicle_id  uuid references public.vehicles(id) on delete set null,
  amount      numeric(10,2) not null,
  due_date    date not null,
  paid_date   date,
  status      text not null default 'pendente' check (status in ('pendente','pago','atrasado')),
  method      text,
  created_at  timestamptz default now()
);

-- ── MANUTENÇÕES ────────────────────────────────────────────
create table if not exists public.maintenances (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid references public.vehicles(id) on delete cascade,
  type            text,
  description     text,
  cost            numeric(10,2) default 0,
  scheduled_date  date,
  done_date       date,
  status          text not null default 'agendada' check (status in ('agendada','andamento','concluida')),
  created_at      timestamptz default now()
);

-- ── CONTRATOS ──────────────────────────────────────────────
create table if not exists public.contracts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.profiles(id) on delete cascade,
  vehicle_id  uuid references public.vehicles(id) on delete set null,
  title       text,
  signed_date date,
  file_name   text,
  file_path   text,         -- caminho no Storage (bucket 'contracts')
  created_at  timestamptz default now()
);

-- ── DOCUMENTOS DO VEÍCULO ──────────────────────────────────
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid references public.vehicles(id) on delete cascade,
  client_id   uuid references public.profiles(id) on delete set null,
  type        text,
  title       text,
  file_name   text,
  file_path   text,         -- caminho no Storage (bucket 'documents')
  created_at  timestamptz default now()
);

-- ── SOLICITAÇÕES DE CONTATO ────────────────────────────────
create table if not exists public.contact_requests (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.profiles(id) on delete cascade,
  subject     text,
  message     text,
  status      text not null default 'aberto' check (status in ('aberto','respondido','fechado')),
  created_at  date default current_date
);

-- ============================================================
-- SEGURANÇA — Row Level Security (RLS)
-- A empresa enxerga tudo; o cliente só os próprios dados.
-- ============================================================

-- função auxiliar: o usuário logado é da empresa?
create or replace function public.is_empresa()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'empresa');
$$;

alter table public.profiles         enable row level security;
alter table public.vehicles         enable row level security;
alter table public.payments         enable row level security;
alter table public.maintenances     enable row level security;
alter table public.contracts        enable row level security;
alter table public.documents        enable row level security;
alter table public.contact_requests enable row level security;

-- PROFILES
create policy "perfil próprio (leitura)" on public.profiles
  for select using (id = auth.uid() or public.is_empresa());
create policy "perfil próprio (update)" on public.profiles
  for update using (id = auth.uid() or public.is_empresa());
create policy "empresa gerencia perfis" on public.profiles
  for all using (public.is_empresa()) with check (public.is_empresa());

-- VEHICLES
create policy "veículos: empresa total" on public.vehicles
  for all using (public.is_empresa()) with check (public.is_empresa());
create policy "veículos: cliente vê o seu" on public.vehicles
  for select using (client_id = auth.uid());

-- PAYMENTS
create policy "pagamentos: empresa total" on public.payments
  for all using (public.is_empresa()) with check (public.is_empresa());
create policy "pagamentos: cliente vê o seu" on public.payments
  for select using (client_id = auth.uid());

-- MAINTENANCES (cliente vê manutenções do veículo dele)
create policy "manutenções: empresa total" on public.maintenances
  for all using (public.is_empresa()) with check (public.is_empresa());
create policy "manutenções: cliente vê do seu veículo" on public.maintenances
  for select using (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.client_id = auth.uid()));

-- CONTRACTS
create policy "contratos: empresa total" on public.contracts
  for all using (public.is_empresa()) with check (public.is_empresa());
create policy "contratos: cliente vê o seu" on public.contracts
  for select using (client_id = auth.uid());

-- DOCUMENTS
create policy "documentos: empresa total" on public.documents
  for all using (public.is_empresa()) with check (public.is_empresa());
create policy "documentos: cliente vê do seu veículo" on public.documents
  for select using (client_id = auth.uid() or exists (select 1 from public.vehicles v where v.id = vehicle_id and v.client_id = auth.uid()));

-- CONTACT REQUESTS
create policy "contato: empresa total" on public.contact_requests
  for all using (public.is_empresa()) with check (public.is_empresa());
create policy "contato: cliente cria o seu" on public.contact_requests
  for insert with check (client_id = auth.uid());
create policy "contato: cliente vê o seu" on public.contact_requests
  for select using (client_id = auth.uid());

-- ============================================================
-- STORAGE — buckets privados para arquivos (PDFs/imagens)
-- ============================================================
insert into storage.buckets (id, name, public) values ('contracts','contracts', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('documents','documents', false)
  on conflict (id) do nothing;

-- Empresa: acesso total aos dois buckets
create policy "storage empresa contracts" on storage.objects
  for all using (bucket_id = 'contracts' and public.is_empresa()) with check (bucket_id = 'contracts' and public.is_empresa());
create policy "storage empresa documents" on storage.objects
  for all using (bucket_id = 'documents' and public.is_empresa()) with check (bucket_id = 'documents' and public.is_empresa());

-- Cliente: leitura dos próprios arquivos (pasta nomeada com o id dele)
create policy "storage cliente contracts (leitura)" on storage.objects
  for select using (bucket_id = 'contracts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage cliente documents (leitura)" on storage.objects
  for select using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- AUTOMÁTICO — cria um perfil sempre que um usuário é criado no Auth.
-- O papel ('empresa' ou 'cliente') vem do campo metadata "role".
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'cliente')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ✅ Pronto. Agora crie os usuários (ver SETUP.md, passo 4).
