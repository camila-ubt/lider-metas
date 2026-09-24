-- Restringe o acesso público à configuração de horários aos campos usados pela Calculadora de Metas.
-- Escritas continuam reservadas aos fluxos autenticados protegidos por RLS.

revoke all privileges on table public.configuracao_horarios_periodos from anon;

grant select (
  id,
  manha_inicio,
  manha_fim,
  noite_inicio,
  noite_fim
) on table public.configuracao_horarios_periodos to anon;
