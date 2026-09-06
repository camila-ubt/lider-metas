-- Repara a divergência do banco instalado, que tinha SELECT/INSERT/UPDATE,
-- mas não a policy de DELETE. Sem ela, a remoção afetava zero registros.
drop policy if exists gestao_remove_conferencias_pa on public.conferencias_pa;
create policy gestao_remove_conferencias_pa
on public.conferencias_pa for delete to authenticated
using (
  exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid())
      and p.ativo = true
      and p.papel in ('admin', 'gestora')
  )
);
grant select, delete on public.conferencias_pa to authenticated;
