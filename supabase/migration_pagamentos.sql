-- ============================================================
-- MIGRAÇÃO — Pagamento pelo app (Pix + comprovante) e notificações
-- Rode no Supabase (SQL Editor) ou via Management API.
-- ============================================================

-- 1) Novo status 'em_analise' (cliente enviou comprovante, aguardando confirmação)
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pendente','pago','atrasado','em_analise'));

-- 2) Colunas para comprovante e plano semanal
alter table public.payments add column if not exists receipt_path  text;
alter table public.payments add column if not exists receipt_name  text;
alter table public.payments add column if not exists submitted_at  timestamptz;
alter table public.payments add column if not exists week_ref      int;

-- 3) Bucket privado para comprovantes
insert into storage.buckets (id, name, public) values ('receipts','receipts', false)
  on conflict (id) do nothing;

drop policy if exists "receipts empresa" on storage.objects;
create policy "receipts empresa" on storage.objects
  for all using (bucket_id='receipts' and public.is_empresa())
  with check (bucket_id='receipts' and public.is_empresa());

drop policy if exists "receipts cliente upload" on storage.objects;
create policy "receipts cliente upload" on storage.objects
  for insert with check (bucket_id='receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts cliente read" on storage.objects;
create policy "receipts cliente read" on storage.objects
  for select using (bucket_id='receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4) Função segura: cliente só consegue mover o PRÓPRIO pagamento para 'em_analise'
--    (evita dar UPDATE amplo ao cliente, que poderia marcar como 'pago')
create or replace function public.submit_payment_receipt(p_id uuid, p_path text, p_name text)
returns void language plpgsql security definer as $$
begin
  update public.payments
     set status = 'em_analise', receipt_path = p_path, receipt_name = p_name, submitted_at = now()
   where id = p_id and client_id = auth.uid()
     and status in ('pendente','atrasado');
end; $$;

grant execute on function public.submit_payment_receipt(uuid, text, text) to authenticated;

-- ✅ Pronto.
