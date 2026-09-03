-- Aprovação administrativa dos lançamentos de PA por vendedora, mês e loja.
-- Estrutura isolada: não altera tabelas existentes do Líder Metas ou do Meu PA.

create table if not exists public.conferencias_pa (
  usuario_id uuid not null references public.usuarios_pa(id) on delete cascade,
  mes date not null,
  loja_id bigint not null references public.lojas(id),
  aprovado_por uuid not null references auth.users(id),
  aprovado_em timestamptz not null default now(),
  primary key (usuario_id, mes, loja_id),
  constraint conferencias_pa_mes_primeiro_dia
    check (mes = date_trunc('month', mes)::date)
);

alter table public.conferencias_pa enable row level security;

drop policy if exists "gestao_le_conferencias_pa" on public.conferencias_pa;
create policy "gestao_le_conferencias_pa"
on public.conferencias_pa for select to authenticated
using (
  exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.ativo = true
      and p.papel in ('admin', 'gestora')
  )
);

drop policy if exists "gestao_insere_conferencias_pa" on public.conferencias_pa;
create policy "gestao_insere_conferencias_pa"
on public.conferencias_pa for insert to authenticated
with check (
  aprovado_por = auth.uid()
  and exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.ativo = true
      and p.papel in ('admin', 'gestora')
  )
);

drop policy if exists "gestao_atualiza_conferencias_pa" on public.conferencias_pa;
create policy "gestao_atualiza_conferencias_pa"
on public.conferencias_pa for update to authenticated
using (
  exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.ativo = true
      and p.papel in ('admin', 'gestora')
  )
)
with check (
  aprovado_por = auth.uid()
  and exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.ativo = true
      and p.papel in ('admin', 'gestora')
  )
);

drop policy if exists "gestao_remove_conferencias_pa" on public.conferencias_pa;
create policy "gestao_remove_conferencias_pa"
on public.conferencias_pa for delete to authenticated
using (
  exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.ativo = true
      and p.papel in ('admin', 'gestora')
  )
);

-- Se a vendedora alterar qualquer lançamento depois da conferência,
-- a aprovação daquela loja/mês é automaticamente invalidada.
create or replace function public.invalidar_conferencia_pa_lancamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_mes date;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select d.usuario_id, date_trunc('month', d.data)::date
      into v_usuario_id, v_mes
    from public.dias_pa d
    where d.id = old.dia_id;

    if v_usuario_id is not null then
      delete from public.conferencias_pa
      where usuario_id = v_usuario_id
        and mes = v_mes
        and loja_id = old.loja_id;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select d.usuario_id, date_trunc('month', d.data)::date
      into v_usuario_id, v_mes
    from public.dias_pa d
    where d.id = new.dia_id;

    if v_usuario_id is not null then
      delete from public.conferencias_pa
      where usuario_id = v_usuario_id
        and mes = v_mes
        and loja_id = new.loja_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists invalidar_conferencia_pa_lancamento_trigger
on public.lancamentos_pa;

create trigger invalidar_conferencia_pa_lancamento_trigger
after insert or update or delete
on public.lancamentos_pa
for each row
execute function public.invalidar_conferencia_pa_lancamento();
