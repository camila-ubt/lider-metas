-- Registra a ausência de trabalho sem inventar vendas ou peças no PA.
-- Respeita a situação existente, datas futuras e o fechamento mensal.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.registrar_dia_nao_trabalhado_pa_gestao(
  p_usuario_id uuid,
  p_data date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := auth.uid();
  v_dia public.dias_pa%rowtype;
begin
  if v_autor is null or not exists (
    select 1 from public.perfis p
    where p.id = v_autor and p.ativo = true
      and p.papel in ('admin', 'gestora')
  ) then
    raise exception 'Somente a gestão ativa pode registrar dias não trabalhados.'
      using errcode = '42501';
  end if;

  if p_usuario_id is null or not exists (
    select 1 from public.usuarios_pa u
    where u.id = p_usuario_id
      and u.tipo_usuario = 'vendedora'
      and u.ativo = true
  ) then
    raise exception 'Vendedora ativa não encontrada.' using errcode = '22023';
  end if;

  if p_data is null or p_data > timezone('America/Sao_Paulo', now())::date then
    raise exception 'Selecione uma data válida que não seja futura.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.fechamentos_pa f
    where f.mes = date_trunc('month', p_data)::date
  ) then
    raise exception 'O mês está fechado. Reabra-o antes de registrar o dia.'
      using errcode = '55000';
  end if;

  insert into public.dias_pa (usuario_id, data, situacao, observacao)
  values (p_usuario_id, p_data, 'nao_trabalhou', null)
  on conflict (usuario_id, data) do nothing;

  select * into v_dia
  from public.dias_pa d
  where d.usuario_id = p_usuario_id and d.data = p_data
  for update;

  if not found then
    raise exception 'Não foi possível registrar o dia. Tente novamente.' using errcode = '40001';
  end if;

  if v_dia.situacao = 'nao_trabalhou' then
    return jsonb_build_object('data', p_data, 'situacao', 'nao_trabalhou');
  end if;

  if v_dia.situacao <> 'trabalhado' then
    raise exception 'Dia já registrado como %. Revise essa situação antes de alterar.', v_dia.situacao
      using errcode = '22023';
  end if;

  if exists (select 1 from public.lancamentos_pa l where l.dia_id = v_dia.id) then
    raise exception 'Esse dia tem vendas lançadas. Revise os lançamentos antes de marcar como não trabalhado.'
      using errcode = '22023';
  end if;

  update public.dias_pa
  set situacao = 'nao_trabalhou',
      observacao = null,
      atualizado_em = now()
  where id = v_dia.id;

  return jsonb_build_object('data', p_data, 'situacao', 'nao_trabalhou');
end;
$$;

revoke all on function private.registrar_dia_nao_trabalhado_pa_gestao(uuid,date)
from public, anon, authenticated;
grant execute on function private.registrar_dia_nao_trabalhado_pa_gestao(uuid,date)
to authenticated;

create or replace function public.registrar_dia_nao_trabalhado_pa_gestao(
  p_usuario_id uuid,
  p_data date
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.registrar_dia_nao_trabalhado_pa_gestao(p_usuario_id, p_data);
$$;

revoke all on function public.registrar_dia_nao_trabalhado_pa_gestao(uuid,date)
from public, anon, authenticated;
grant execute on function public.registrar_dia_nao_trabalhado_pa_gestao(uuid,date)
to authenticated;
