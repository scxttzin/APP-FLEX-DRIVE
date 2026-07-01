-- ============================================================
-- MIGRAÇÃO v9 — Parceiro: endereço + link de localização
-- (partners.location passa a significar "Endereço"; map_link é o link do mapa)
-- ============================================================
alter table public.partners      add column if not exists map_link     text;
alter table public.maintenances  add column if not exists partner_link text;

-- ✅ Pronto.
