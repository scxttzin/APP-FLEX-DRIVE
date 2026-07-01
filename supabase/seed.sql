-- ============================================================
-- FLEX DRIVE — Dados de exemplo (OPCIONAL)
-- Rode DEPOIS do schema.sql, no SQL Editor do Supabase.
--
-- Estes veículos entram como "disponíveis" (sem cliente),
-- então não dependem de nenhum usuário existir. Você pode
-- vincular cada um a um cliente depois, pela tela da Empresa.
-- ============================================================

insert into public.vehicles (plate, brand, model, year, color, renavam, km, status, weekly_value, next_revision) values
  ('RDF1A23', 'BYD',        'Dolphin Mini', 2024, 'Branco', '01234567890', 12450, 'disponivel', 650, current_date + 22),
  ('VWX4D56', 'BYD',        'Dolphin Mini', 2024, 'Azul',   '31234567893',  4100, 'disponivel', 650, current_date + 55),
  ('BCD6F78', 'Volkswagen', 'Polo Track',   2023, 'Preto',  '51234567895', 22000, 'disponivel', 580, current_date + 60),
  ('YZA5E67', 'GWM',        'Ora 03',       2024, 'Branco', '41234567894', 15600, 'manutencao', 700, current_date + 2);

-- ------------------------------------------------------------
-- Para criar PAGAMENTOS / CONTRATOS de exemplo de um cliente,
-- primeiro descubra o ID dele (Authentication → Users, ou):
--   select id, full_name from public.profiles where role = 'cliente';
-- Depois troque <ID_DO_CLIENTE> e <ID_DO_VEICULO> abaixo e rode:
-- ------------------------------------------------------------
-- insert into public.payments (client_id, vehicle_id, amount, due_date, status, method) values
--   ('<ID_DO_CLIENTE>', '<ID_DO_VEICULO>', 650, current_date + 2, 'pendente', 'Pix'),
--   ('<ID_DO_CLIENTE>', '<ID_DO_VEICULO>', 650, current_date - 5, 'pago',     'Pix');
--
-- update public.vehicles set status = 'locado', client_id = '<ID_DO_CLIENTE>'
--   where plate = 'RDF1A23';
