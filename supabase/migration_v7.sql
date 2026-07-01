-- ============================================================
-- MIGRAÇÃO v7 — Parceiros (oficinas/mecânicos) + vínculo na manutenção
-- ============================================================

create table if not exists public.partners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text,               -- função: Revisão, Concessionária, Mecânico, Lanternagem...
  location   text,               -- endereço / localização
  created_at timestamptz default now()
);

alter table public.partners enable row level security;
drop policy if exists "parceiros: empresa total" on public.partners;
create policy "parceiros: empresa total" on public.partners
  for all using (public.is_empresa()) with check (public.is_empresa());

-- vínculo do parceiro na manutenção (nome/localização denormalizados p/ o motorista ver)
alter table public.maintenances add column if not exists partner_id       uuid references public.partners(id) on delete set null;
alter table public.maintenances add column if not exists partner_name     text;
alter table public.maintenances add column if not exists partner_location text;

-- ✅ Pronto.
