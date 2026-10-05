-- Fecha um mês já conferido do PA e impede alterações posteriores.
-- O fechamento exige todas as lojas com movimento de vendedoras ativas aprovadas.
-- Gestão ativa pode fechar; somente administradora ativa pode reabrir.

create table if not exists public.fechamentos_pa (
  mes date primary key,
  fechado_por uuid not null references auth.users(id),
  fechado_em timestamptz not null default now(),
  constraint fechamentos_pa_mes_primeiro_dia
    check (mes = date_trunc('month', mes)::date)
);

alter table public.fechamentos_pa enable row level security;

revoke all on table public.fechamentos_pa from public, anon, authenticated;
grant select on table public.fechamentos_pa to authenticated;

drop policy if exists "gestao_le_fechamentos_pa" on public.fechamentos_pa;
create policy "gestao_le_fechamentos_pa"
on public.fechamentos_pa for select to authenticated
using (
  exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.ativo = true
      and p.papel in ('admin', 'gestora')
  )
);

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.fechar_mes_pa(p_mes date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := auth.uid();
  v_fechado_em timestamptz;
begin
  if v_autor is null or not exists (
    select 1
    from public.perfis p
    where p.id = v_autor
      and p.ativo = true
      and p.papel in ('admin', 'gestora')
  ) then
    raise exception 'Somente a gestão ativa pode fechar o mês.' using errcode = '42501';
  end if;

  if p_mes is null or p_mes <> date_trunc('month', p_mes)::date then
    raise exception 'Informe o primeiro dia do mês que será fechado.' using errcode = '22023';
  end if;

  if p_mes >= date_trunc('month', timezone('America/Sao_Paulo', now()))::date then
    raise exception 'O mês só pode ser fechado depois que terminar.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.fechamentos_pa f
    where f.mes = p_mes
  ) then
    raise exception 'Este mês já está fechado.' using errcode = '23505';
  end if;

  if not exists (
    select 1
    from public.dias_pa d
    join public.lancamentos_pa l on l.dia_id = d.id
    join public.usuarios_pa u on u.id = d.usuario_id
    where date_trunc('month', d.data)::date = p_mes
      and d.situacao = 'trabalhado'
      and u.ativo = true
  ) then
    raise exception 'Não há lançamentos ativos para fechar neste mês.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select distinct d.usuario_id, l.loja_id
      from public.dias_pa d
      join public.lancamentos_pa l on l.dia_id = d.id
      join public.usuarios_pa u on u.id = d.usuario_id
      where date_trunc('month', d.data)::date = p_mes
        and d.situacao = 'trabalhado'
        and u.ativo = true
    ) movimento
    where not exists (
      select 1
      from public.conferencias_pa c
      where c.usuario_id = movimento.usuario_id
        and c.mes = p_mes
        and c.loja_id = movimento.loja_id
    )
  ) then
    raise exception 'Ainda existem lançamentos sem aprovação. Aprove todas as lojas antes de fechar o mês.'
      using errcode = '22023';
  end if;

  insert into public.fechamentos_pa (mes, fechado_por)
  values (p_mes, v_autor)
  returning fechado_em into v_fechado_em;

  return jsonb_build_object(
    'mes', p_mes,
    'fechado_por', v_autor,
    'fechado_em', v_fechado_em
  );
end;
$$;

create or replace function private.reabrir_mes_pa(p_mes date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := auth.uid();
  v_fechamento public.fechamentos_pa%rowtype;
begin
  if v_autor is null or not exists (
    select 1
    from public.perfis p
    where p.id = v_autor
      and p.ativo = true
      and p.papel = 'admin'
  ) then
    raise exception 'Somente uma administradora ativa pode reabrir o mês.' using errcode = '42501';
  end if;

  if p_mes is null or p_mes <> date_trunc('month', p_mes)::date then
    raise exception 'Informe o primeiro dia do mês que será reaberto.' using errcode = '22023';
  end if;

  delete from public.fechamentos_pa
  where mes = p_mes
  returning * into v_fechamento;

  if not found then
    raise exception 'Este mês não está fechado.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'mes', v_fechamento.mes,
    'reaberto_por', v_autor
  );
end;
$$;

create or replace function public.fechar_mes_pa(p_mes date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.fechar_mes_pa(p_mes);
$$;

create or replace function public.reabrir_mes_pa(p_mes date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.reabrir_mes_pa(p_mes);
$$;

revoke all on function private.fechar_mes_pa(date) from public, anon, authenticated;
revoke all on function private.reabrir_mes_pa(date) from public, anon, authenticated;
revoke all on function public.fechar_mes_pa(date) from public, anon, authenticated;
revoke all on function public.reabrir_mes_pa(date) from public, anon, authenticated;

grant execute on function private.fechar_mes_pa(date) to authenticated;
grant execute on function private.reabrir_mes_pa(date) to authenticated;
grant execute on function public.fechar_mes_pa(date) to authenticated;
grant execute on function public.reabrir_mes_pa(date) to authenticated;

create or replace function private.bloquear_dias_pa_mes_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1
    from public.fechamentos_pa f
    where f.mes = date_trunc('month', old.data)::date
  ) then
    raise exception 'Este mês está fechado e não permite alterações no PA.' using errcode = '55000';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and exists (
    select 1
    from public.fechamentos_pa f
    where f.mes = date_trunc('month', new.data)::date
  ) then
    raise exception 'Este mês está fechado e não permite alterações no PA.' using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.bloquear_lancamentos_pa_mes_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data date;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select d.data into v_data
    from public.dias_pa d
    where d.id = old.dia_id;

    if v_data is not null and exists (
      select 1
      from public.fechamentos_pa f
      where f.mes = date_trunc('month', v_data)::date
    ) then
      raise exception 'Este mês está fechado e não permite alterações no PA.' using errcode = '55000';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select d.data into v_data
    from public.dias_pa d
    where d.id = new.dia_id;

    if v_data is not null and exists (
      select 1
      from public.fechamentos_pa f
      where f.mes = date_trunc('month', v_data)::date
    ) then
      raise exception 'Este mês está fechado e não permite alterações no PA.' using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.bloquear_conferencias_pa_mes_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
    select 1
    from public.fechamentos_pa f
    where f.mes = old.mes
  ) then
    raise exception 'Este mês está fechado e não permite alterar aprovações.' using errcode = '55000';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and exists (
    select 1
    from public.fechamentos_pa f
    where f.mes = new.mes
  ) then
    raise exception 'Este mês está fechado e não permite alterar aprovações.' using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists bloquear_dias_pa_mes_fechado_trigger on public.dias_pa;
create trigger bloquear_dias_pa_mes_fechado_trigger
before insert or update or delete
on public.dias_pa
for each row
execute function private.bloquear_dias_pa_mes_fechado();

drop trigger if exists bloquear_lancamentos_pa_mes_fechado_trigger on public.lancamentos_pa;
create trigger bloquear_lancamentos_pa_mes_fechado_trigger
before insert or update or delete
on public.lancamentos_pa
for each row
execute function private.bloquear_lancamentos_pa_mes_fechado();

drop trigger if exists bloquear_conferencias_pa_mes_fechado_trigger on public.conferencias_pa;
create trigger bloquear_conferencias_pa_mes_fechado_trigger
before insert or update or delete
on public.conferencias_pa
for each row
execute function private.bloquear_conferencias_pa_mes_fechado();
