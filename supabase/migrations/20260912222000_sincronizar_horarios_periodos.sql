-- Configuração compartilhada dos horários usada pelo Líder Metas e pela Calculadora de Metas.
create table if not exists public.configuracao_horarios_periodos (
  id smallint primary key default 1 check (id = 1),
  manha_inicio time not null default '09:00',
  manha_fim time not null default '16:00',
  noite_inicio time not null default '16:00',
  noite_fim time not null default '22:00',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id)
);

alter table public.configuracao_horarios_periodos enable row level security;

drop policy if exists horarios_publicos_leitura on public.configuracao_horarios_periodos;
create policy horarios_publicos_leitura
on public.configuracao_horarios_periodos
for select
to anon, authenticated
using (true);

drop policy if exists horarios_admin_atualiza on public.configuracao_horarios_periodos;
create policy horarios_admin_atualiza
on public.configuracao_horarios_periodos
for update
to authenticated
using ((select private.usuario_admin()))
with check ((select private.usuario_admin()));

grant select on public.configuracao_horarios_periodos to anon, authenticated;
grant update on public.configuracao_horarios_periodos to authenticated;

insert into public.configuracao_horarios_periodos (
  id, manha_inicio, manha_fim, noite_inicio, noite_fim
)
values (1, '10:00', '16:00', '16:00', '22:00')
on conflict (id) do nothing;
