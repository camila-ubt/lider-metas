-- Correção administrativa e aviso são gravados na mesma transação.
create table public.correcoes_pa (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios_pa(id) on delete cascade,
  dia_id uuid not null,
  data date not null,
  loja_id bigint not null references public.lojas(id),
  loja text not null,
  vendas_antes integer not null,
  pecas_antes integer not null,
  vendas_depois integer not null,
  pecas_depois integer not null,
  motivo text not null check (char_length(btrim(motivo)) between 3 and 500),
  corrigido_por uuid not null references auth.users(id),
  corrigido_por_nome text not null,
  criado_em timestamptz not null default now(),
  lida_em timestamptz
);

-- O histórico permanece mesmo se o dia ou lançamento for removido depois.
alter table public.correcoes_pa enable row level security;
revoke all on public.correcoes_pa from public, anon, authenticated;
grant select on public.correcoes_pa to authenticated;
grant update (lida_em) on public.correcoes_pa to authenticated;

create policy correcoes_pa_leitura on public.correcoes_pa
for select to authenticated using (
  (usuario_id = (select auth.uid()) and exists (
    select 1 from public.usuarios_pa u where u.id = (select auth.uid()) and u.ativo
  )) or exists (
    select 1 from public.perfis p where p.id = (select auth.uid())
      and p.ativo and p.papel in ('admin', 'gestora')
  )
);
create policy correcoes_pa_marcar_lida on public.correcoes_pa
for update to authenticated
using (usuario_id = (select auth.uid()) and exists (
  select 1 from public.usuarios_pa u where u.id = (select auth.uid()) and u.ativo
))
with check (usuario_id = (select auth.uid()) and exists (
  select 1 from public.usuarios_pa u where u.id = (select auth.uid()) and u.ativo
));

create index correcoes_pa_pendentes_idx on public.correcoes_pa (usuario_id, criado_em desc)
where lida_em is null;
create index correcoes_pa_autor_idx on public.correcoes_pa (corrigido_por);
create index correcoes_pa_loja_idx on public.correcoes_pa (loja_id);

create schema if not exists private;
grant usage on schema private to authenticated;

-- Privilégio limitado à operação validada: não concede edição direta à gestão.
create function private.corrigir_lancamento_pa(
  p_usuario_id uuid, p_dia_id uuid, p_data date, p_loja_id bigint,
  p_vendas_antes integer, p_pecas_antes integer,
  p_vendas integer, p_pecas integer, p_motivo text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_autor uuid := auth.uid();
  v_nome text;
  v_dia public.dias_pa%rowtype;
  v_lancamento public.lancamentos_pa%rowtype;
  v_correcao uuid;
begin
  select coalesce(nullif(btrim(p.nome), ''), 'Gestão') into v_nome
  from public.perfis p
  where p.id = v_autor and p.ativo and p.papel in ('admin', 'gestora');
  if v_autor is null or not found then
    raise exception 'Somente a gestão ativa pode corrigir lançamentos.' using errcode = '42501';
  end if;
  if p_vendas is null or p_pecas is null or p_vendas not between 0 and 999
    or p_pecas not between 0 and 999 or p_pecas < p_vendas then
    raise exception 'Informe vendas e peças entre 0 e 999, com peças iguais ou maiores que vendas.' using errcode = '22023';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) not between 3 and 500 then
    raise exception 'Informe o motivo da correção (3 a 500 caracteres).' using errcode = '22023';
  end if;

  select * into v_dia from public.dias_pa where id = p_dia_id for update;
  if not found or v_dia.usuario_id is distinct from p_usuario_id
    or v_dia.data is distinct from p_data or v_dia.situacao <> 'trabalhado' then
    raise exception 'O dia foi alterado ou removido. Reabra os lançamentos antes de corrigir.' using errcode = '40001';
  end if;
  select * into v_lancamento from public.lancamentos_pa
  where dia_id = p_dia_id and loja_id = p_loja_id for update;
  if not found or v_lancamento.vendas is distinct from p_vendas_antes
    or v_lancamento.pecas is distinct from p_pecas_antes then
    raise exception 'O lançamento mudou. Reabra os lançamentos antes de corrigir.' using errcode = '40001';
  end if;
  if p_vendas = v_lancamento.vendas and p_pecas = v_lancamento.pecas then
    raise exception 'Altere vendas ou peças para registrar uma correção.' using errcode = '22023';
  end if;

  update public.lancamentos_pa set vendas = p_vendas, pecas = p_pecas, atualizado_em = now()
  where id = v_lancamento.id;
  -- O trigger existente invalida a conferência da loja/mês.
  insert into public.correcoes_pa (
    usuario_id, dia_id, data, loja_id, loja, vendas_antes, pecas_antes,
    vendas_depois, pecas_depois, motivo, corrigido_por, corrigido_por_nome
  ) values (
    v_dia.usuario_id, v_dia.id, v_dia.data, p_loja_id,
    (select coalesce(l.codigo, l.nome) from public.lojas l where l.id = p_loja_id),
    v_lancamento.vendas, v_lancamento.pecas, p_vendas, p_pecas,
    btrim(p_motivo), v_autor, v_nome
  ) returning id into v_correcao;
  return v_correcao;
end;
$$;
revoke all on function private.corrigir_lancamento_pa(uuid,uuid,date,bigint,integer,integer,integer,integer,text) from public, anon, authenticated;
grant execute on function private.corrigir_lancamento_pa(uuid,uuid,date,bigint,integer,integer,integer,integer,text) to authenticated;

create function public.corrigir_lancamento_pa(
  p_usuario_id uuid, p_dia_id uuid, p_data date, p_loja_id bigint,
  p_vendas_antes integer, p_pecas_antes integer,
  p_vendas integer, p_pecas integer, p_motivo text
) returns uuid language sql security invoker set search_path = '' as $$
  select private.corrigir_lancamento_pa(p_usuario_id,p_dia_id,p_data,p_loja_id,
    p_vendas_antes,p_pecas_antes,p_vendas,p_pecas,p_motivo);
$$;
revoke all on function public.corrigir_lancamento_pa(uuid,uuid,date,bigint,integer,integer,integer,integer,text) from public, anon, authenticated;
grant execute on function public.corrigir_lancamento_pa(uuid,uuid,date,bigint,integer,integer,integer,integer,text) to authenticated;
