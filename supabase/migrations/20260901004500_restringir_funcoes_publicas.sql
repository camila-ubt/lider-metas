begin;

-- As metas do aplicativo exigem uma conta ativa. Esta função SECURITY
-- DEFINER não deve contornar as políticas de acesso das tabelas.
revoke execute on function public.metas_publicas() from public, anon, authenticated;

-- A função de timestamp é chamada pelos gatilhos do banco e não precisa ser
-- executável diretamente pelos clientes da API.
revoke execute on function public.atualizar_timestamp() from public, anon, authenticated;

commit;
