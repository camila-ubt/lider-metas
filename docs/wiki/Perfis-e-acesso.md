# Perfis e acesso

## Estados de uma conta

- **Sem sessão:** pode apenas entrar ou solicitar cadastro.
- **Cadastro pendente:** a conta existe, mas aguarda liberação.
- **Perfil ativo:** pode acessar os dados permitidos pelas políticas.
- **Perfil administrativo:** possui também as funções de gestão.

## Perfil operacional

Um usuário ativo pode consultar as informações necessárias à operação e trabalhar com os lançamentos diários, conforme as políticas do banco.

## Perfil administrativo

Além das funções operacionais, pode:

- cadastrar e editar metas;
- alterar horários dos períodos compartilhados com a Calculadora de Metas;
- acessar recursos gerenciais reservados;
- conferir e corrigir o PA das vendedoras;
- aprovar novos cadastros de vendedoras;
- desativar ou reativar perfis já aprovados.

A interface oculta a área administrativa para outros perfis, e o banco repete essa proteção por políticas de acesso.

A gestão das vendedoras fica na aba **Vendedoras**, exibida somente para administradoras. A aba selecionada é preservada quando a página é atualizada.

## Solicitações pendentes

O cadastro cria uma identidade no serviço de autenticação e um perfil de aplicação. Uma nova vendedora permanece sem acesso até a aprovação administrativa.

O fluxo é:

1. a vendedora realiza o cadastro no Cálculo PA;
2. o perfil aparece em **Vendedoras > Solicitações pendentes**;
3. a administradora confere nome, número Athos e data do cadastro;
4. ao selecionar **Aprovar e ativar**, o acesso é liberado nos sistemas integrados.

O número ao lado da aba **Vendedoras** indica quantas solicitações aguardam análise.

## Padronização dos nomes

Os nomes das vendedoras são exibidos em **caixa alta** nas áreas de gestão e PA. A padronização também é aplicada visualmente aos cadastros antigos, evitando diferenças entre nomes digitados com letras maiúsculas ou minúsculas.

## Vendedoras cadastradas

Depois da primeira aprovação, o perfil passa para **Vendedoras cadastradas**. A lista pode ser filtrada por:

- **Ativas:** podem acessar o PA;
- **Desativadas:** já foram aprovadas, mas estão sem acesso;
- **Todas:** reúne o histórico de perfis aprovados.

Use **Desativar perfil** quando uma vendedora sair da equipe. O histórico é preservado e o perfil pode ser recuperado depois com **Reativar perfil**, sem novo cadastro.

Uma vendedora desativada não volta para as solicitações pendentes. Essa separação evita confundir ex-integrantes da equipe com novos pedidos de acesso.

## Recuperação de senha

Para senha esquecida, utilize o fluxo oficial de recuperação. O link enviado por e-mail deve abrir diretamente a etapa de criação da nova senha quando ainda estiver válido.

A partir da **v1.3.0**, o fluxo aceita a sessão de recuperação enviada no próprio link do e-mail e mantém compatibilidade com links anteriores baseados em código. Links expirados, já utilizados ou inválidos são recusados e exigem uma nova solicitação.

A partir da **v1.4.0**, login, cadastro e recuperação contam também com bloqueio temporário após falhas consecutivas no mesmo navegador. Criação e redefinição de senha exigem pelo menos 8 caracteres, com letra maiúscula, minúscula e número.

## Responsabilidades

- cada pessoa deve usar sua própria conta;
- acessos devem ser revogados quando deixarem de ser necessários;
- permissões administrativas devem ser mínimas;
- senhas não devem ser compartilhadas ou armazenadas no repositório;
- atividades suspeitas devem ser comunicadas e investigadas.

## O que fazer em caso de perda de acesso

Confirme primeiro se o e-mail está correto e se o perfil continua ativo. Para senha esquecida, use o processo oficial de recuperação. Não crie uma segunda conta para contornar um bloqueio.

Consulte [Banco de dados e segurança](Banco-de-dados-e-seguranca).
