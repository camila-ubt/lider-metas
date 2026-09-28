-- Permite que a gestão inclua um lançamento ausente diretamente na conferência do PA.
-- A operação usa o mesmo banco do Cálculo PA, portanto o registro passa a aparecer para a vendedora.

create schema if not exists private;
grant usage on schema private to authenticated;

create function private.adicionar_lancamento_pa_gestao(
  p_usuario_id uuid,
  p_data date,
  p_loja_id bigint,
  p_vendas integer,
  p_pecas integer
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor uuid := auth.uid();
  v_dia public.dias_pa%rowtype;
  v_lancamento_id bigint;
begin
  if v_autor is null or not exists (
    select 1
    from public.perfis p
    where p.id = v_autor
      and p.ativo
      and p.papel in ('admin', 'gestora')
  ) then
    raise exception 'Somente a gestão ativa pode adicionar lançamentos.' using errcode = '42501';
  end if;

  if p_usuario_id is null or not exists (
    select 1 from public.usuarios_pa u where u.id = p_usuario_id
  ) then
    raise exception 'Vendedora não encontrada.' using errcode = '22023';
  end if;

  if p_data is null then
    raise exception 'Informe a data do lançamento.' using errcode = '22023';
  end if;

  if p_loja_id is null or not exists (
    select 1 from public.lojas l where l.id = p_loja_id and l.ativa
  ) then
    raise exception 'Escolha uma loja ativa.' using errcode = '22023';
  end if;

  if p_vendas is null or p_pecas is null
    or p_vendas not between 0 and 999
    or p_pecas not between 0 and 999
    or p_pecas < p_vendas then
    raise exception 'Informe vendas e peças entre 0 e 999, com peças iguais ou maiores que vendas.'
      using errcode = '22023';
  end if;

  insert into public.dias_pa (usuario_id, data, situacao)
  values (p_usuario_id, p_data, 'trabalhado')
  on conflict (usuario_id, data) do nothing;

  select *
    into v_dia
  from public.dias_pa
  where usuario_id = p_usuario_id
    and data = p_data
  for update;

  if not found then
    raise exception 'Não foi possível preparar o dia para o lançamento.' using errcode = '40001';
  end if;

  if v_dia.situacao <> 'trabalhado' then
    raise exception 'A data escolhida está marcada como %. Revise o dia antes de adicionar vendas.', v_dia.situacao
      using errcode = '22023';
  end if;

  begin
    insert into public.lancamentos_pa (dia_id, loja_id, vendas, pecas)
    values (v_dia.id, p_loja_id, p_vendas, p_pecas)
    returning id into v_lancamento_id;
  exception
    when unique_violation then
      raise exception 'Já existe lançamento para essa loja e data. Use Corrigir no detalhamento diário.'
        using errcode = '23505';
  end;

  -- O trigger de lancamentos_pa invalida automaticamente uma conferência anterior da loja/mês.
  return v_lancamento_id;
end;
$$;

revoke all on function private.adicionar_lancamento_pa_gestao(uuid,date,bigint,integer,integer)
from public, anon, authenticated;
grant execute on function private.adicionar_lancamento_pa_gestao(uuid,date,bigint,integer,integer)
to authenticated;

create function public.adicionar_lancamento_pa_gestao(
  p_usuario_id uuid,
  p_data date,
  p_loja_id bigint,
  p_vendas integer,
  p_pecas integer
) returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.adicionar_lancamento_pa_gestao(
    p_usuario_id, p_data, p_loja_id, p_vendas, p_pecas
  );
$$;

revoke all on function public.adicionar_lancamento_pa_gestao(uuid,date,bigint,integer,integer)
from public, anon, authenticated;
grant execute on function public.adicionar_lancamento_pa_gestao(uuid,date,bigint,integer,integer)
to authenticated;
