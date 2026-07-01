-- ============================================================
-- MIGRAÇÃO v3 — Cadastro de motorista pela empresa,
-- 2º motorista (conta conjunta) e troca de senha no 1º acesso.
-- ============================================================

-- ── Campos extras no perfil ──
alter table public.profiles add column if not exists second_name  text;
alter table public.profiles add column if not exists second_cpf   text;
alter table public.profiles add column if not exists second_phone text;
alter table public.profiles add column if not exists must_change_password boolean not null default false;

-- ── Trigger reforçado: novo usuário SEMPRE entra como 'cliente' (motorista) ──
-- (impede escalonamento de privilégio mesmo com cadastro aberto)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    'cliente',
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- ✅ Pronto. (Os cadastros são reabilitados via API de config — ver script Node.)
