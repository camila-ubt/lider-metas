-- Ajusta a conferência do PA para ocultar vendedoras desativadas
-- e permite que a gestão registre um período de férias no mesmo fluxo administrativo.

create or replace view public.resumo_pa_mensal as
with dias_resumidos as (
  select
    d.id,
    d.usuario_id,
    d.data,
    d.situacao,
    coalesce(sum(l.vendas), 0)::integer as vendas,
    coalesce(sum(l.pecas), 0)::integer as pecas
  from public.dias_pa d
  left join public.lancamentos_pa l on l.dia_id = d.id
  group by d.id, d.usuario_id, d.data, d.situacao
),
mensal as (
  select
    u.id as usuario_id,
    u.nome,
    u.numero_athos,
    date_trunc('month', d.data)::date as mes,
    count(*) filter (where d.situacao = 'trabalhado')::integer as dias_validos,
    coalesce(sum(d.vendas) filter (where d.situacao = 'trabalhado'), 0)::integer as vendas,
    coalesce(sum(d.pecas) filter (where d.situacao = 'trabalhado'), 0)::integer as pecas,
    bool_or(d.data = (date_trunc('month', d.data) + interval '1 month - 1 day')::date) as ultimo_dia_preenchido
  from public.usuarios_pa u
  join dias_resumidos d on d.usuario_id = u.id
  where u.ativo = true
  group by u.id, u.nome, u.numero_athos, date_trunc('month', d.data)
)
select
  usuario_id,
  nome,
  numero_athos,
  mes,
  dias_validos,
  vendas,
  pecas,
  case when vendas > 0 then round(pecas::numeric / vendas::numeric, 2) else 0::numeric end as pa,
  ultimo_dia_preenchido,
  case
    when not ultimo_dia_preenchido then null::integer
    when dias_validos < 15 then 0
    when vendas = 0 then 0
    when pecas::numeric / vendas::numeric >= 2.60 then 150
    when pecas::numeric / vendas::numeric >= 2.20 then 100
    else 0
  end as premiacao_prevista
from mensal;

create or replace view public.resumo_pa_mensal_loja as
select
  u.id as usuario_id,
  u.nome,
  u.numero_athos,
  date_trunc('month', d.data)::date as mes,
  l.loja_id,
  loja.codigo as loja,
  loja.nome as loja_nome,
  count(distinct d.data)::integer as dias_na_loja,
  sum(l.vendas)::integer as vendas,
  sum(l.pecas)::integer as pecas,
  case
    when sum(l.vendas) > 0 then round(sum(l.pecas)::numeric / sum(l.vendas)::numeric, 2)
    else 0::numeric
  end as pa
from public.usuarios_pa u
join public.dias_pa d on d.usuario_id = u.id
join public.lancamentos_pa l on l.dia_id = d.id
join public.lojas loja on loja.id = l.loja_id
where d.situacao = 'trabalhado'
  and u.ativo = true
group by
  u.id,
  u.nome,
  u.numero_athos,
  date_trunc('month', d.data),
  l.loja_id,
  loja.codigo,
  loja.nome;

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.registrar_ferias_pa_gestao(
  p_usuario_id uuid,
  p_inicio date,
  p_fim date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := auth.uid();
  v_dias integer;
  v_lancamentos_removidos integer := 0;
begin
  if v_autor is null or not exists (
    select 1
    from public.perfis p
    where p.id = v_autor
      and p.ativo
      and p.papel in ('admin', 'gestora')
  ) then
    raise exception 'Somente a gestão ativa pode registrar férias.' using errcode = '42501';
  end if;

  if p_usuario_id is null or not exists (
    select 1
    from public.usuarios_pa u
    where u.id = p_usuario_id
      and u.tipo_usuario = 'vendedora'
      and u.ativo
  ) then
    raise exception 'Vendedora ativa não encontrada.' using errcode = '22023';
  end if;

  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Confira as datas de início e fim das férias.' using errcode = '22023';
  end if;

  v_dias := (p_fim - p_inicio) + 1;
  if v_dias > 62 then
    raise exception 'O período de férias deve ter no máximo 62 dias por operação.' using errcode = '22023';
  end if;

  select count(*)
    into v_lancamentos_removidos
  from public.lancamentos_pa l
  join public.dias_pa d on d.id = l.dia_id
  where d.usuario_id = p_usuario_id
    and d.data between p_inicio and p_fim;

  delete from public.lancamentos_pa l
  using public.dias_pa d
  where l.dia_id = d.id
    and d.usuario_id = p_usuario_id
    and d.data between p_inicio and p_fim;

  insert into public.dias_pa (usuario_id, data, situacao, observacao)
  select p_usuario_id, gs::date, 'ferias', null
  from generate_series(p_inicio::timestamp, p_fim::timestamp, interval '1 day') gs
  on conflict (usuario_id, data)
  do update set
    situacao = 'ferias',
    observacao = null,
    atualizado_em = now();

  return jsonb_build_object(
    'dias', v_dias,
    'lancamentos_removidos', v_lancamentos_removidos
  );
end;
$$;

revoke all on function private.registrar_ferias_pa_gestao(uuid,date,date)
from public, anon, authenticated;
grant execute on function private.registrar_ferias_pa_gestao(uuid,date,date)
to authenticated;

create or replace function public.registrar_ferias_pa_gestao(
  p_usuario_id uuid,
  p_inicio date,
  p_fim date
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.registrar_ferias_pa_gestao(p_usuario_id, p_inicio, p_fim);
$$;

revoke all on function public.registrar_ferias_pa_gestao(uuid,date,date)
from public, anon, authenticated;
grant execute on function public.registrar_ferias_pa_gestao(uuid,date,date)
to authenticated;
