-- ============================================================
-- MIGRAÇÃO v2 — Manutenção solicitada pelo motorista,
-- vigência/renovação de contratos.
-- ============================================================

-- ── MANUTENÇÕES: solicitação pelo motorista ──
alter table public.maintenances drop constraint if exists maintenances_status_check;
alter table public.maintenances add constraint maintenances_status_check
  check (status in ('solicitada','agendada','andamento','concluida'));
alter table public.maintenances add column if not exists requested_by uuid references public.profiles(id) on delete set null;
alter table public.maintenances add column if not exists km          int;
alter table public.maintenances add column if not exists photo_path  text;
alter table public.maintenances add column if not exists category    text;   -- 'completa' | 'desgaste'
alter table public.maintenances add column if not exists wear_type   text;   -- 'pneus' | 'pastilha' | 'outros'

-- ── CONTRATOS: vigência + renovação ──
alter table public.contracts add column if not exists start_date date;
alter table public.contracts add column if not exists end_date   date;
alter table public.contracts add column if not exists status     text not null default 'vigente';
-- status: 'vigente' | 'renovacao_solicitada' | 'substituido' | 'encerrado'

-- ── Bucket privado para fotos do painel (km) ──
insert into storage.buckets (id, name, public) values ('maintenance','maintenance', false) on conflict (id) do nothing;
drop policy if exists "maint empresa" on storage.objects;
create policy "maint empresa" on storage.objects
  for all using (bucket_id='maintenance' and public.is_empresa()) with check (bucket_id='maintenance' and public.is_empresa());
drop policy if exists "maint motorista upload" on storage.objects;
create policy "maint motorista upload" on storage.objects
  for insert with check (bucket_id='maintenance' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "maint motorista read" on storage.objects;
create policy "maint motorista read" on storage.objects
  for select using (bucket_id='maintenance' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── RPC: motorista solicita manutenção (entra como 'solicitada') ──
create or replace function public.request_maintenance(p_vehicle uuid, p_km int, p_photo text, p_category text, p_wear text, p_desc text)
returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  if not exists (select 1 from public.vehicles where id = p_vehicle and client_id = auth.uid()) then
    raise exception 'Veículo não pertence ao motorista';
  end if;
  insert into public.maintenances (vehicle_id, requested_by, km, photo_path, category, wear_type, type, description, status, cost, scheduled_date)
  values (p_vehicle, auth.uid(), p_km, p_photo, p_category, p_wear,
          case when p_category = 'desgaste' then coalesce(initcap(p_wear), 'Desgaste') else 'Revisão completa' end,
          p_desc, 'solicitada', 0, current_date)
  returning id into new_id;
  update public.vehicles set km = greatest(coalesce(km,0), p_km) where id = p_vehicle;
  return new_id;
end; $$;
grant execute on function public.request_maintenance(uuid, int, text, text, text, text) to authenticated;

-- ── RPC: motorista solicita renovação de contrato ──
create or replace function public.request_contract_renewal(p_contract uuid)
returns void language plpgsql security definer as $$
begin
  update public.contracts set status = 'renovacao_solicitada'
   where id = p_contract and client_id = auth.uid() and status in ('vigente');
end; $$;
grant execute on function public.request_contract_renewal(uuid) to authenticated;

-- ── Backfill de vigência nos contratos de exemplo ──
update public.contracts set start_date = signed_date, end_date = signed_date + interval '6 months' where end_date is null;
-- contrato do João fica vencido (para demonstrar a renovação)
update public.contracts set end_date = current_date - 4
  where client_id = (select id from public.profiles where email = 'joao@cliente.com');

-- ✅ Pronto.
