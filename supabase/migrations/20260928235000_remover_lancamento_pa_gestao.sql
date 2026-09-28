-- Permite que a gestão remova um lançamento de PA incorreto ou duplicado.
-- A remoção registra aviso para a vendedora e preserva o histórico administrativo.

create function private.remover_lancamento_pa_gestao(
  p_usuario_id uuid,
  p_dia_id uuid,
  p_data date,
  p_loja_id bigint,
  p_vendas_antes integer,
  p_pecas_antes integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := auth.uid();
  v_nome text;
  v_dia public.dias_pa%rowtype;
  v_lancamento public.lancamentos_pa%rowtype;
  v_aviso uuid;
begin
  select coalesce(nullif(btrim(p.nome), ''), 'Gestão')
    into v_nome
  from public.perfis p
  where p.id = v_autor
    and p.ativo
    and p.papel in ('admin', 'gestora');

  if v_autor is null or not found then
    raise exception 'Somente a gestão ativa pode remover lançamentos.' using errcode = '42501';
  end if;

  select *
    into v_dia
  from public.dias_pa
  where id = p_dia_id
  for update;

  if not found
    or v_dia.usuario_id is distinct from p_usuario_id
    or v_dia.data is distinct from p_data
    or v_dia.situacao <> 'trabalhado' then
    raise exception 'O dia foi alterado ou removido. Reabra os lançamentos antes de remover.'
      using errcode = '40001';
  end if;

  select *
    into v_lancamento
  from public.lancamentos_pa
  where dia_id = p_dia_id
    and loja_id = p_loja_id
  for update;

  if not found then
    raise exception 'O lançamento não existe mais. Atualize a tela antes de remover.'
      using errcode = '40001';
  end if;

  if v_lancamento.vendas is distinct from p_vendas_antes
    or v_lancamento.pecas is distinct from p_pecas_antes then
    raise exception 'O lançamento mudou. Reabra os lançamentos antes de remover.'
      using errcode = '40001';
  end if;

  insert into public.correcoes_pa (
    usuario_id, dia_id, data, loja_id, loja,
    vendas_antes, pecas_antes, vendas_depois, pecas_depois,
    motivo, corrigido_por, corrigido_por_nome
  ) values (
    v_dia.usuario_id, v_dia.id, v_dia.data, p_loja_id,
    (select coalesce(l.codigo, l.nome) from public.lojas l where l.id = p_loja_id),
    v_lancamento.vendas, v_lancamento.pecas, 0, 0,
    'Lançamento removido pela gestão',
    v_autor, v_nome
  ) returning id into v_aviso;

  delete from public.lancamentos_pa
  where id = v_lancamento.id;

  -- Se era o único lançamento daquele dia, o dia deixa de contar no PA.
  if not exists (
    select 1
    from public.lancamentos_pa l
    where l.dia_id = v_dia.id
  ) then
    delete from public.dias_pa
    where id = v_dia.id;
  end if;

  return v_aviso;
end;
$$;

revoke all on function private.remover_lancamento_pa_gestao(uuid,uuid,date,bigint,integer,integer)
from public, anon, authenticated;
grant execute on function private.remover_lancamento_pa_gestao(uuid,uuid,date,bigint,integer,integer)
to authenticated;

create function public.remover_lancamento_pa_gestao(
  p_usuario_id uuid,
  p_dia_id uuid,
  p_data date,
  p_loja_id bigint,
  p_vendas_antes integer,
  p_pecas_antes integer
) returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.remover_lancamento_pa_gestao(
    p_usuario_id, p_dia_id, p_data, p_loja_id, p_vendas_antes, p_pecas_antes
  );
$$;

revoke all on function public.remover_lancamento_pa_gestao(uuid,uuid,date,bigint,integer,integer)
from public, anon, authenticated;
grant execute on function public.remover_lancamento_pa_gestao(uuid,uuid,date,bigint,integer,integer)
to authenticated;
