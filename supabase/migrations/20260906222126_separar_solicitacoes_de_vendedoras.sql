alter table public.perfis
  add column if not exists aprovado_em timestamptz;

update public.perfis
set aprovado_em = coalesce(aprovado_em, atualizado_em, criado_em)
where papel = 'vendedora'
  and ativo = true;

create or replace function private.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  autorizacao private.usuarios_pre_autorizados%rowtype;
  eh_vendedora_pa boolean;
  ativo_inicial boolean;
begin
  select *
    into autorizacao
  from private.usuarios_pre_autorizados
  where lower(email) = lower(new.email)
  limit 1;

  eh_vendedora_pa :=
    nullif(new.raw_user_meta_data ->> 'numero_athos', '') is not null;

  ativo_inicial := coalesce(
    autorizacao.ativo,
    case
      when eh_vendedora_pa then false
      else false
    end
  );

  insert into public.perfis (id, nome, papel, ativo, aprovado_em)
  values (
    new.id,
    coalesce(
      nullif(autorizacao.nome, ''),
      nullif(new.raw_user_meta_data ->> 'nome', ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(
      autorizacao.papel,
      case
        when eh_vendedora_pa then 'vendedora'
        else 'gestora'
      end
    ),
    ativo_inicial,
    case when ativo_inicial then now() else null end
  )
  on conflict (id) do update
  set nome = excluded.nome,
      papel = excluded.papel,
      ativo = excluded.ativo,
      aprovado_em = coalesce(public.perfis.aprovado_em, excluded.aprovado_em);

  return new;
end;
$function$;
