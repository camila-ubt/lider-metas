# FAQ

## Meu cadastro foi concluído, mas não consigo acessar os dados

O perfil provavelmente aguarda aprovação. Solicite a ativação à administradora e evite criar outra conta.

## Esqueci minha senha. O que devo fazer?

Use a recuperação oficial de senha. O link enviado por e-mail deve abrir a etapa para criar uma nova senha. Se o link estiver expirado, já tiver sido usado ou for inválido, solicite outro.

## Os meses anteriores ficam salvos?

Sim. Vendas e metas são persistidas por mês e podem ser consultadas pelo seletor.

## Por que o painel parece errado?

Confirme o mês, as metas e as pendências. Uma venda ausente ou incorreta altera totais, ranking, projeções e insights.

## O que significam M e N?

Representam manhã e noite. O indicador fica completo quando todos os slots esperados do período foram registrados.

## Os horários da manhã e da noite são os mesmos da Calculadora de Metas?

Sim. A partir da v1.3.0, os dois sistemas usam a mesma configuração compartilhada de horários. Alterações feitas pela gestão no Líder Metas passam a valer também como referência na Calculadora de Metas.

## Valor zero conta como lançamento?

Sim. Use zero somente quando a situação real justificar, preferencialmente pela opção de caixa não aberto.

## Como corrigir uma venda?

Abra a data, selecione o lançamento existente, altere o valor e salve. Depois refaça a conferência.

## Posso confiar na projeção com pendências?

Não integralmente. Ela usa apenas os dados disponíveis e pode ficar artificialmente alta ou baixa.

## Por que manhã e noite têm necessidades diárias diferentes?

Cada período possui meta, vendas e oportunidades restantes próprias.

## Quem pode alterar metas e horários dos períodos?

Somente perfis administrativos. A interface e o banco aplicam essa restrição.

## Qual é a regra dos níveis?

Meta 100%, Supermeta 110% e Megameta 120%.

## A chave publishable do Supabase é secreta?

Não. Ela é destinada ao navegador e tem baixo privilégio. Chaves secretas e `service_role`, por outro lado, nunca podem ser expostas.

## O código público torna os dados públicos?

Não. Código e dados são camadas diferentes. O acesso aos dados depende de autenticação, grants e RLS. Mesmo assim, segredos nunca devem ser incluídos no código.

## Onde registrar um problema?

Use as [Issues](https://github.com/camila-ubt/lider-metas/issues) sem incluir dados comerciais, credenciais ou capturas com informações sensíveis.

## Como fechar um mês?

Abra “PA das vendedoras” e selecione um mês anterior ao atual. Confira cada vendedora e loja e use “Aprovar lançamentos”.

Administradoras e gestoras podem usar “Fechar mês” quando todas as lojas com lançamentos das vendedoras ativas estiverem aprovadas. Confirme o fechamento.

O fim do mês no calendário não fecha automaticamente o PA. O fechamento depende dessa conferência e confirmação.

## O que fica bloqueado após o fechamento?

O PA do mês continua disponível para consulta. Novos lançamentos, correções, remoções, férias e alterações de aprovação desse mês ficam bloqueados.

Essa regra pertence ao fechamento do PA. Não confunda com o relatório de fechamento das vendas e metas do painel.

## Como corrigir um mês fechado?

Peça a uma administradora ativa para selecionar o mês e usar “Reabrir mês”. Gestoras e vendedoras não podem reabrir.

Após a reabertura, faça a correção, refaça as aprovações necessárias e feche novamente quando a conferência estiver concluída.

## Qual é a ordem recomendada de uso?

1. Conferir o mês selecionado.

2. Lançar ou corrigir todas as lojas e períodos.

3. Conferir com o Athos.

4. Só depois analisar Painel, ranking, projeções e insights.

## O que fazer se uma loja ou período não aparecer?

Confira o mês selecionado e atualize a página. Se persistir, verifique se a loja está ativa e se a meta do período foi cadastrada.

## O que fazer se o total do painel não bater com o Athos?

Revise os dias na Conferência com o Athos, procurando diferenças por loja e período. Use o lápis para abrir e corrigir diretamente o lançamento divergente.

## Posso confiar na projeção com lançamentos pendentes?

Não totalmente. A projeção usa os dados disponíveis. Pendências ou valores incorretos podem reduzir ou aumentar artificialmente o resultado projetado.

## Quem pode alterar metas e horários?

Somente perfis com permissão de administradora visualizam a aba Metas e essas configurações.

## O PA não aceita vendas e peças. O que conferir?

Informe números inteiros de 0 a 999. Peças devem ser iguais ou maiores que vendas. Valores negativos, decimais ou campos vazios impedem a correção.

Confira se a data não está em férias e se o mês não está fechado. Antes de repetir um envio, veja se o registro já foi salvo.

## Por que não consigo editar o PA?

Confira se o mês está fechado e se seu perfil tem acesso à ação. Para mês fechado, procure a administradora para reabrir antes de corrigir.

## Por que a vendedora não aparece?

Confira o mês, os filtros e se há lançamentos. A administradora pode consultar o cadastro entre ativos, desativados e solicitações pendentes. Evite criar outra conta.

## Meu cadastro aguarda liberação. O que fazer?

Solicite a aprovação à administradora. Se esqueceu a senha, use a recuperação por e-mail; para link expirado ou já utilizado, solicite um novo.

## Não aparece a opção de imprimir no celular.

A impressão depende do navegador e do dispositivo. Confira se a janela de impressão abriu; se necessário, acesse pelo computador conectado à impressora.

## Como encontrar uma instrução rapidamente?

Use “Buscar no manual” ou toque em um atalho abaixo. A busca aceita palavras com ou sem acento, abre as respostas encontradas e permite limpar o filtro.
