create or replace function private.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  autorizacao private.usuarios_pre_autorizados%rowtype;
  eh_vendedora_pa boolean;
begin
  select * into autorizacao
  from private.usuarios_pre_autorizados
  where lower(email) = lower(new.email)
  limit 1;

  eh_vendedora_pa := nullif(new.raw_user_meta_data ->> 'numero_athos', '') is not null;

  insert into public.perfis (id, nome, papel, ativo)
  values (
    new.id,
    coalesce(nullif(autorizacao.nome, ''), nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    coalesce(autorizacao.papel, case when eh_vendedora_pa then 'vendedora' else 'gestora' end),
    coalesce(autorizacao.ativo, false)
  )
  on conflict (id) do update
  set nome = excluded.nome,
      papel = excluded.papel,
      ativo = excluded.ativo;

  return new;
end;
$$;
