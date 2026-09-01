begin;

-- A calculadora pública consome somente o mês e os seis valores agregados
-- retornados pela função. As permissões de coluna e as políticas abaixo não
-- expõem usuários, vendas, autoria ou datas de auditoria.
revoke all on table public.lojas from anon;
revoke all on table public.metas_mensais from anon;

grant select (id, codigo) on table public.lojas to anon;
grant select (mes, loja_id, periodo, valor_meta)
  on table public.metas_mensais to anon;

drop policy if exists "calculadora_visualiza_lojas" on public.lojas;
create policy "calculadora_visualiza_lojas"
on public.lojas
for select
to anon
using (codigo in ('CB', 'AA', 'AB'));

drop policy if exists "calculadora_visualiza_metas" on public.metas_mensais;
create policy "calculadora_visualiza_metas"
on public.metas_mensais
for select
to anon
using (
  periodo in ('manha', 'noite')
  and loja_id in (
    select id
    from public.lojas
    where codigo in ('CB', 'AA', 'AB')
  )
);

-- A função passa a respeitar os privilégios e o RLS do papel chamador.
alter function public.metas_publicas() security invoker;
alter function public.metas_publicas() set search_path = '';

-- Mantém a função inacessível por herança ampla e libera somente o papel
-- anônimo usado pela Calculadora de Metas.
revoke execute on function public.metas_publicas() from public, authenticated;
grant execute on function public.metas_publicas() to anon;

commit;
