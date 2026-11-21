-- Registro imutável da primeira previsão consultada em cada dia e recorte.
-- O histórico só é gravado após uma consulta autenticada da gestão.
create table if not exists public.previsoes_diarias (
  id uuid primary key default gen_random_uuid(),
  data_previsao date not null,
  mes date not null,
  filtro_loja text not null,
  filtro_periodo text not null
    check (filtro_periodo in ('todos', 'manha', 'noite')),
  dia_base integer not null check (dia_base between 3 and 31),
  projecao_valor numeric(14,2) not null check (projecao_valor >= 0),
  chance_meta_original integer not null check (chance_meta_original between 0 and 100),
  chance_super_original integer not null check (chance_super_original between 0 and 100),
  chance_mega_original integer not null check (chance_mega_original between 0 and 100),
  chance_meta integer not null check (chance_meta between 0 and 100),
  chance_super integer not null check (chance_super between 0 and 100),
  chance_mega integer not null check (chance_mega between 0 and 100),
  meses_calibracao integer not null default 0 check (meses_calibracao >= 0),
  modelo text not null default 'historico-v2-calibracao',
  registrado_por uuid not null default auth.uid() references auth.users(id),
  registrado_em timestamptz not null default now(),
  constraint previsoes_mes_primeiro_dia check (mes = date_trunc('month', mes)::date),
  constraint previsoes_data_pertence_mes
    check (data_previsao >= mes and data_previsao < (mes + interval '1 month')::date),
  constraint previsoes_dia_recorte_unico
    unique (data_previsao, mes, filtro_loja, filtro_periodo)
);

create index if not exists previsoes_diarias_mes_idx
  on public.previsoes_diarias (mes desc, filtro_loja, filtro_periodo, data_previsao);

alter table public.previsoes_diarias enable row level security;
revoke all on table public.previsoes_diarias from public, anon, authenticated;
grant select, insert on table public.previsoes_diarias to authenticated;

create policy "gestao_le_previsoes_diarias"
on public.previsoes_diarias for select to authenticated
using (exists (
  select 1 from public.perfis p
  where p.id = (select auth.uid())
    and p.ativo = true and p.papel in ('admin', 'gestora')
));

create policy "gestao_registra_previsao_do_dia"
on public.previsoes_diarias for insert to authenticated
with check (
  registrado_por = (select auth.uid())
  and data_previsao = timezone('America/Sao_Paulo', now())::date
  and mes = date_trunc('month', timezone('America/Sao_Paulo', now()))::date
  and exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid())
      and p.ativo = true and p.papel in ('admin', 'gestora')
  )
);

-- Sem políticas de UPDATE ou DELETE: previsões antigas não podem ser reescritas.
