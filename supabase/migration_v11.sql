-- ============================================================
-- MIGRATION v11 — Métodos de cobrança (várias chaves Pix) +
--                 juros por marca + chave vinculada ao motorista
-- Rode UMA VEZ no SQL Editor do Supabase (Modo Real).
-- No Modo Demo nada disso é necessário (fica tudo no navegador).
-- Requer o migration_v10.sql já aplicado (tabela app_settings).
-- ============================================================

-- 1) Vários métodos de cobrança + exceções de juros por marca (jsonb)
--    methods:    [{ id, label, pix_key, pix_name, pix_city }]
--    late_fees:  [{ brand, value }]  (ex.: BYD = 30, outras usam late_fee_per_day)
alter table public.app_settings add column if not exists methods   jsonb not null default '[]'::jsonb;
alter table public.app_settings add column if not exists late_fees  jsonb not null default '[]'::jsonb;

-- 2) Chave Pix vinculada a cada motorista (qual método ele usa para pagar)
--    Aponta para methods[].id em app_settings.
alter table public.profiles add column if not exists payment_method_id text;

-- O motorista precisa ler o próprio payment_method_id (as policies de leitura
-- da própria linha em profiles já cobrem isso). A empresa grava via updateDriver.
