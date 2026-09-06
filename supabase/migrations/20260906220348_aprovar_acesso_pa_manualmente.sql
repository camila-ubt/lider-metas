create or replace function public.criar_usuario_pa_automaticamente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios_pa (id, nome, numero_athos, tipo_usuario, ativo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'numero_athos', '')::integer,
    'vendedora',
    false
  )
  on conflict (id) do update
  set nome = excluded.nome,
      numero_athos = excluded.numero_athos;

  return new;
end;
$$;
