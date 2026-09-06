# Líder Metas v1.2.0 — Integração do PA

A versão 1.2.0 amplia o Líder Metas com recursos de acompanhamento e administração do PA das vendedoras, integrando o fluxo operacional do Cálculo PA ao painel de gestão.

## PA das vendedoras

O Líder Metas passa a concentrar a conferência dos dados de PA por loja e por vendedora, permitindo acompanhar vendas, quantidade de peças e resultados utilizados no cálculo.

## Correções de lançamentos

A gestão pode corrigir lançamentos de vendas ou peças quando houver divergência na conferência. As alterações ficam vinculadas ao fluxo do PA e podem gerar notificação para a vendedora, mantendo transparência sobre os ajustes realizados.

## Aprovação de novas vendedoras

Novos cadastros de vendedoras não recebem acesso automaticamente. O perfil entra como solicitação pendente e precisa ser aprovado pela administração antes de ser ativado.

O fluxo é:

1. a vendedora realiza o cadastro;
2. o banco registra o perfil como pendente;
3. a solicitação aparece no Líder Metas;
4. a administração confere os dados e aprova;
5. o acesso ao PA é ativado.

## Configuração das vendedoras

A área de configuração separa os perfis em duas categorias:

- **Solicitações pendentes:** novos cadastros que ainda nunca foram aprovados;
- **Vendedoras cadastradas:** perfis que já passaram pela aprovação.

Dentro de Vendedoras cadastradas há filtros para:

- Ativas;
- Desativadas;
- Todas.

Uma vendedora desativada permanece no histórico e pode ser reativada posteriormente sem necessidade de criar um novo cadastro.

## Histórico e rotatividade

A separação entre solicitação pendente e perfil desativado evita que ex-vendedoras sejam confundidas com novos pedidos de acesso. Isso permite manter o histórico mesmo com a rotatividade da equipe.

## Integração com o banco

O fluxo utiliza o Supabase compartilhado pelo Líder Metas e pelo Cálculo PA. O estado de acesso é sincronizado entre os perfis administrativos e os usuários do PA.

A partir desta versão também é registrado quando uma vendedora foi aprovada pela primeira vez, permitindo distinguir com segurança:

- cadastro novo aguardando aprovação;
- vendedora ativa;
- vendedora já aprovada e posteriormente desativada.

## Versão

**Líder Metas v1.2.0**

Esta versão sucede a v1.1.1 e representa uma atualização funcional do sistema, com integração do PA e gestão de acesso das vendedoras.
