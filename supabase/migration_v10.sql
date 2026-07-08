-- ============================================================
-- MIGRATION v10 — Configuração de pagamento + 2ª foto de manutenção
-- Rode UMA VEZ no SQL Editor do Supabase (Modo Real).
-- No Modo Demo nada disso é necessário (fica tudo no navegador).
-- ============================================================

-- 1) CONFIGURAÇÃO DE PAGAMENTO (chave Pix + juros por dia de atraso)
create table if not exists public.app_settings (
  id               text primary key,
  pix_key          text,
  pix_name         text,
  pix_city         text,
  late_fee_per_day numeric not null default 0,
  updated_at       timestamptz default now()
);

alter table public.app_settings enable row level security;

-- Qualquer usuário autenticado LÊ (o motorista precisa da chave/juros p/ gerar o Pix)
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

-- Apenas a EMPRESA grava/edita
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'empresa'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'empresa'));

-- 2) SEGUNDA FOTO DA MANUTENÇÃO
--    Revisão completa = 2 anexos: foto do veículo (photo_path2) + foto do painel (photo_path).
--    Desgaste = 1 anexo: foto do desgaste (photo_path).
alter table public.maintenances add column if not exists photo_path2 text;

-- Permite o motorista gravar a 2ª foto na PRÓPRIA solicitação (logo após criá-la)
drop policy if exists maintenances_owner_update on public.maintenances;
create policy maintenances_owner_update on public.maintenances
  for update to authenticated
  using      (requested_by = auth.uid())
  with check (requested_by = auth.uid());
