-- ============================================================
-- MIGRATION v12 — Gasto com seguro por veículo (visível só p/ empresa)
-- Rode UMA VEZ no SQL Editor do Supabase (Modo Real).
-- No Modo Demo nada disso é necessário.
-- ============================================================

-- Valor gasto em seguro daquele veículo. Aparece só no painel da empresa;
-- o app do motorista nunca exibe esse valor.
alter table public.vehicles add column if not exists insurance_cost numeric not null default 0;

-- OBS.: se você quiser IMPEDIR no servidor que o motorista leia esse valor
-- (não apenas escondê-lo na tela), o ideal é migrar o seguro para uma tabela
-- separada (ex.: vehicle_costs) com RLS restrita à role 'empresa'. Como o app
-- usa uma única tabela vehicles com leitura pelo locatário, aqui o valor fica
-- oculto apenas na interface do motorista.
