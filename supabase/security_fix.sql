-- ============================================================
-- CORREÇÕES DE SEGURANÇA — rode no Supabase (SQL Editor → Run)
-- ============================================================

-- 1) 🔴 CRÍTICO: impedir que um motorista se promova a "empresa"
--    (a política de update do próprio perfil não bloqueava a troca de "role").
--    Este gatilho barra qualquer mudança de papel feita por quem não é empresa.
create or replace function public.protect_role_change()
returns trigger language plpgsql security definer as $$
begin
  if not public.is_empresa() and new.role is distinct from old.role then
    raise exception 'Alteração de papel não permitida.';
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_role on public.profiles;
create trigger trg_protect_role
  before update on public.profiles
  for each row execute function public.protect_role_change();

-- 2) 🟠 Motorista precisa conseguir abrir os DOCUMENTOS DO VEÍCULO.
--    Eles ficam na pasta com o id do veículo; a política antiga só liberava a
--    pasta com o id do próprio usuário. Corrige para liberar os documentos dos
--    veículos que pertencem ao motorista.
drop policy if exists "storage cliente documents (leitura)" on storage.objects;
create policy "storage cliente documents (leitura)" on storage.objects
  for select using (
    bucket_id = 'documents' and exists (
      select 1 from public.vehicles v
      where v.client_id = auth.uid()
        and (storage.foldername(name))[1] = v.id::text
    )
  );

-- 3) Reforço: todo novo usuário SEMPRE entra como 'cliente' (motorista),
--    ignorando qualquer "role" enviado no cadastro (defesa em profundidade).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role, must_change_password)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    'cliente',
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ✅ Pronto. Depois disso o backend fica sólido.
