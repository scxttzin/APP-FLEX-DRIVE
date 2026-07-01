-- ============================================================
-- MIGRAÇÃO v5 — Foto do veículo
-- ============================================================
alter table public.vehicles add column if not exists photo_url text;

-- bucket público para fotos de veículos (leitura pública, escrita só empresa)
insert into storage.buckets (id, name, public) values ('vehicles','vehicles', true) on conflict (id) do nothing;
drop policy if exists "veh photo empresa" on storage.objects;
create policy "veh photo empresa" on storage.objects
  for all using (bucket_id = 'vehicles' and public.is_empresa())
  with check (bucket_id = 'vehicles' and public.is_empresa());

-- ✅ Pronto.
