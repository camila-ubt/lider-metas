create table if not exists public.clima_observado (
  data date not null,
  periodo text not null check (periodo in ('manha', 'noite')),
  clima text not null check (clima in ('sol', 'nublado', 'garoa', 'chuva', 'forte')),
  registrado_por uuid not null default auth.uid() references auth.users(id),
  atualizado_em timestamptz not null default now(),
  primary key (data, periodo)
);

alter table public.clima_observado enable row level security;

create policy "usuarios_ativos_visualizam_clima_observado"
on public.clima_observado
for select
to authenticated
using ((select private.usuario_ativo()));

create policy "usuarios_ativos_registram_clima_observado"
on public.clima_observado
for insert
to authenticated
with check ((select private.usuario_ativo()));

create policy "usuarios_ativos_atualizam_clima_observado"
on public.clima_observado
for update
to authenticated
using ((select private.usuario_ativo()))
with check ((select private.usuario_ativo()));

create policy "usuarios_ativos_excluem_clima_observado"
on public.clima_observado
for delete
to authenticated
using ((select private.usuario_ativo()));
