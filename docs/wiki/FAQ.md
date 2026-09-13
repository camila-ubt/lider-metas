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
