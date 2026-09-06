# Banco de dados e segurança

## Estruturas principais

| Tabela | Finalidade |
|---|---|
| `perfis` | situação e papel de cada usuário |
| `lojas` | unidades habilitadas para operação |
| `metas_mensais` | meta por mês, loja e período |
| `vendas_diarias` | lançamentos por data, loja e período |

O banco também possui estruturas auxiliares para módulos experimentais. Elas não fazem parte do fluxo principal descrito nesta Wiki.

## Row Level Security

Todas as tabelas expostas possuem RLS habilitado. As políticas distinguem usuário autenticado, perfil ativo e perfil administrativo.

Em resumo:

- visitantes não consultam os dados operacionais;
- usuários ativos consultam lojas, metas e vendas necessárias ao aplicativo;
- usuários ativos trabalham com lançamentos;
- alterações de metas, lojas e perfis exigem papel administrativo;
- dados auxiliares vinculados a um usuário permanecem isolados por identidade.

## Funções de autorização

Funções privadas verificam se o usuário está ativo ou se possui papel administrativo. Elas usam o identificador da sessão, não informações informadas pela interface.

## Funções públicas restringidas

A migração de segurança mais recente retirou de visitantes e usuários comuns a execução direta de funções que poderiam contornar o fluxo normal de acesso. Somente papéis administrativos do serviço permaneceram autorizados.

## Chaves

- a chave **publishable** é de baixo privilégio e foi criada para uso no navegador;
- chaves secretas e `service_role` nunca devem aparecer no cliente, na Wiki, em commits ou em logs;
- a segurança dos dados depende da combinação entre autenticação, grants e RLS;
- arquivos de ambiente não são versionados.

## Segurança do GitHub

- repositório público;
- `main` protegida por Ruleset;
- Pull Request obrigatório;
- exclusão e force push bloqueados;
- administradora preservada como bypass de recuperação;
- Dependabot alerts e atualizações de segurança ativos;
- Secret Scanning e Push Protection ativos;
- token do GitHub Actions somente para leitura, sem aprovação de PR.

## Limitação conhecida

A verificação de senhas vazadas do Supabase depende de um plano pago e não está disponível no plano atual. As demais proteções de autenticação e banco continuam ativas.

## Resposta a incidente

Se um segredo for publicado:

1. remova o acesso ou rotacione a chave imediatamente;
2. verifique logs e alertas;
3. remova o segredo do histórico quando necessário;
4. revise a causa da exposição;
5. documente a correção sem registrar o valor secreto.
