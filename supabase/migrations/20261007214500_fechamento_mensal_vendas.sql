-- Fecha um único mês de vendas após o último dia estar completo.
-- O fechamento é manual e não afeta outros meses.

create table if not exists public.fechamentos_vendas (
  mes date primary key,
  fechado_por uuid not null references auth.users(id),
  fechado_em timestamptz not null default now(),
  constraint fechamentos_vendas_mes_primeiro_dia
    check (mes = date_trunc('month', mes)::date)
);

alter table public.fechamentos_vendas enable row level security;

revoke all on table public.fechamentos_vendas from public, anon, authenticated;
grant select on table public.fechamentos_vendas to authenticated;

drop policy if exists "usuarios_ativos_leem_fechamentos_vendas" on public.fechamentos_vendas;
create policy "usuarios_ativos_leem_fechamentos_vendas"
on public.fechamentos_vendas for select
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

create or replace function private.fechar_mes_vendas(p_mes date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := auth.uid();
  v_ultimo_dia date;
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
  v_fechado_em timestamptz;
begin
  if v_autor is null or not exists (
    select 1
    from public.perfis p
    where p.id = v_autor
      and p.ativo = true
      and p.papel in ('admin', 'gestora')
  ) then
    raise exception 'Somente a gestão ativa pode fechar o mês.'
      using errcode = '42501';
  end if;

  if p_mes is null or p_mes <> date_trunc('month', p_mes)::date then
    raise exception 'Informe o primeiro dia do mês que será fechado.'
      using errcode = '22023';
  end if;

  v_ultimo_dia := (p_mes + interval '1 month - 1 day')::date;

  if v_hoje < v_ultimo_dia then
    raise exception 'O mês só pode ser fechado no último dia ou depois.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.fechamentos_vendas f where f.mes = p_mes
  ) then
    raise exception 'Este mês já está fechado.'
      using errcode = '23505';
  end if;

  if not exists (
    select 1 from public.lojas l where l.ativa = true
  ) then
    raise exception 'Nenhuma loja ativa foi encontrada.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.lojas l
    cross join (values ('manha'::text), ('noite'::text)) as p(periodo)
    where l.ativa = true
      and not exists (
        select 1
        from public.vendas_diarias v
        where v.data = v_ultimo_dia
          and v.loja_id = l.id
          and v.periodo = p.periodo
      )
  ) then
    raise exception 'Preencha manhã e noite de todas as lojas no último dia antes de fechar o mês.'
      using errcode = '22023';
  end if;

  insert into public.fechamentos_vendas (mes, fechado_por)
  values (p_mes, v_autor)
  returning fechado_em into v_fechado_em;

  return jsonb_build_object(
    'mes', p_mes,
    'fechado_por', v_autor,
    'fechado_em', v_fechado_em
  );
end;
$$;

create or replace function public.fechar_mes_vendas(p_mes date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.fechar_mes_vendas(p_mes);
$$;

revoke all on function private.fechar_mes_vendas(date) from public, anon, authenticated;
revoke all on function public.fechar_mes_vendas(date) from public, anon, authenticated;
grant execute on function private.fechar_mes_vendas(date) to authenticated;
grant execute on function public.fechar_mes_vendas(date) to authenticated;

create or replace function private.bloquear_vendas_mes_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1
    from public.fechamentos_vendas f
    where f.mes = date_trunc('month', old.data)::date
  ) then
    raise exception 'Este mês está fechado e disponível somente para consulta.'
      using errcode = '55000';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and exists (
    select 1
    from public.fechamentos_vendas f
    where f.mes = date_trunc('month', new.data)::date
  ) then
    raise exception 'Este mês está fechado e disponível somente para consulta.'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.bloquear_metas_mes_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1
    from public.fechamentos_vendas f
    where f.mes = old.mes
  ) then
    raise exception 'Este mês está fechado e disponível somente para consulta.'
      using errcode = '55000';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and exists (
    select 1
    from public.fechamentos_vendas f
    where f.mes = new.mes
  ) then
    raise exception 'Este mês está fechado e disponível somente para consulta.'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists bloquear_vendas_mes_fechado_trigger on public.vendas_diarias;
create trigger bloquear_vendas_mes_fechado_trigger
before insert or update or delete
on public.vendas_diarias
for each row
execute function private.bloquear_vendas_mes_fechado();

drop trigger if exists bloquear_metas_mes_fechado_trigger on public.metas_mensais;
create trigger bloquear_metas_mes_fechado_trigger
before insert or update or delete
on public.metas_mensais
for each row
execute function private.bloquear_metas_mes_fechado();
