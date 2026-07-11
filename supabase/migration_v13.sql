-- ============================================================
-- MIGRATION v13 — Confirmação de manutenção pelo motorista
-- Rode UMA VEZ no SQL Editor do Supabase (Modo Real).
-- ============================================================

-- Comprovante do serviço realizado (concessionária/oficina) enviado pelo motorista
alter table public.maintenances add column if not exists done_receipt_path text;
alter table public.maintenances add column if not exists done_receipt_name text;

-- O motorista confirma a manutenção que ele mesmo solicitou (status -> concluida,
-- done_date, cost e comprovante). A policy maintenances_owner_update (migration_v10)
-- já permite o dono (requested_by = auth.uid()) atualizar a própria manutenção.
