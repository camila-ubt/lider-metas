-- Fecha todos os meses de vendas anteriores ao mês atual e protege o histórico.
-- O fechamento é cumulativo: uma nova execução apenas avança o limite até o fim do mês passado.

create table if not exists public.fechamento_vendas (
  id smallint primary key default 1,
  fechado_ate date not null,
  fechado_por uuid not null references auth.users(id),
  fechado_em timestamptz not null default now(),
  constraint fechamento_vendas_id_unico check (id = 1)
);

alter table public.fechamento_vendas enable row level security;

revoke all on table public.fechamento_vendas from public, anon, authenticated;
grant select on table public.fechamento_vendas to authenticated;

drop policy if exists "usuarios_ativos_leem_fechamento_vendas" on public.fechamento_vendas;
create policy "usuarios_ativos_leem_fechamento_vendas"
on public.fechamento_vendas for select
to authenticated
using (
  exists (
    select 1
    from public.perfis p
    where p.id = (select auth.uid())
      and p.ativo = true
  )
);

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.fechar_historico_vendas()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := auth.uid();
  v_limite date := date_trunc('month', timezone('America/Sao_Paulo', now()))::date - 1;
  v_resultado public.fechamento_vendas%rowtype;
begin
  if v_autor is null or not exists (
    select 1
    from public.perfis p
    where p.id = v_autor
      and p.ativo = true
      and p.papel in ('admin', 'gestora')
  ) then
    raise exception 'Somente a gestão ativa pode fechar os meses anteriores.'
      using errcode = '42501';
  end if;

  insert into public.fechamento_vendas (id, fechado_ate, fechado_por)
  values (1, v_limite, v_autor)
  on conflict (id) do update
    set fechado_ate = excluded.fechado_ate,
        fechado_por = excluded.fechado_por,
        fechado_em = now()
    where excluded.fechado_ate > public.fechamento_vendas.fechado_ate
  returning * into v_resultado;

  if not found then
    select * into v_resultado
    from public.fechamento_vendas
    where id = 1;
  end if;

  return jsonb_build_object(
    'fechado_ate', v_resultado.fechado_ate,
    'fechado_por', v_resultado.fechado_por,
    'fechado_em', v_resultado.fechado_em
  );
end;
$$;

create or replace function public.fechar_historico_vendas()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.fechar_historico_vendas();
$$;

revoke all on function private.fechar_historico_vendas() from public, anon, authenticated;
revoke all on function public.fechar_historico_vendas() from public, anon, authenticated;

grant execute on function private.fechar_historico_vendas() to authenticated;
grant execute on function public.fechar_historico_vendas() to authenticated;

create or replace function private.bloquear_vendas_historicas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite date;
begin
  select f.fechado_ate
  into v_limite
  from public.fechamento_vendas f
  where f.id = 1;

  if v_limite is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.data <= v_limite then
    raise exception 'Este mês está fechado e disponível somente para consulta.'
      using errcode = '55000';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.data <= v_limite then
    raise exception 'Este mês está fechado e disponível somente para consulta.'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.bloquear_metas_historicas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite date;
begin
  select f.fechado_ate
  into v_limite
  from public.fechamento_vendas f
  where f.id = 1;

  if v_limite is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.mes <= v_limite then
    raise exception 'Este mês está fechado e disponível somente para consulta.'
      using errcode = '55000';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.mes <= v_limite then
    raise exception 'Este mês está fechado e disponível somente para consulta.'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists bloquear_vendas_historicas_trigger on public.vendas_diarias;
create trigger bloquear_vendas_historicas_trigger
before insert or update or delete
on public.vendas_diarias
for each row
execute function private.bloquear_vendas_historicas();

drop trigger if exists bloquear_metas_historicas_trigger on public.metas_mensais;
create trigger bloquear_metas_historicas_trigger
before insert or update or delete
on public.metas_mensais
for each row
execute function private.bloquear_metas_historicas();
