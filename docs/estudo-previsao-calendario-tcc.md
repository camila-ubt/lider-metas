# Estudo experimental: previsão de vendas com calendário

Esta implementação é um modelo candidato para o TCC de Ciência de Dados. Não altera a previsão oficial, os lançamentos, as metas, o PA, as probabilidades ou o banco Supabase.

## Pergunta de pesquisa

Considerar o dia da semana e os feriados nacionais brasileiros reduz o erro da previsão do faturamento mensal das lojas, quando comparado ao motor operacional já utilizado?

## Método

O motor oficial permanece em src/lib/projecaoTurnos.mjs. O candidato está em src/lib/previsaoCalendario.mjs e o backtest pareado em src/lib/validacaoCalendario.mjs.

A aprendizagem ocorre separadamente por loja e turno, em meses anteriores completos, limitados aos 24 meses antes do mês-alvo. Cada venda diária é dividida pela média do respectivo mês para separar padrões de calendário das diferenças de faturamento entre meses. Os multiplicadores aprendidos dos dias da semana são suavizados e limitados de 0,75 a 1,25. Feriados nacionais, incluindo a Sexta-feira Santa, recebem efeito adicional limitado de 0,85 a 1,15, apenas com seis ou mais observações.

O valor acumulado é dividido pela soma dos pesos dos dias observados e multiplicado pela soma dos pesos de todos os dias do mês. O modelo requer sete dias corridos registrados e quatro meses históricos completos, e nunca transforma lançamentos ausentes em venda zero. Um zero explícito é aceito.

Feriados federais considerados: 1º de janeiro, 21 de abril, 1º de maio, 7 de setembro, 12 de outubro, 2, 15 e 20 de novembro e 25 de dezembro, além da Sexta-feira Santa. Carnaval, pontos facultativos e feriados estaduais/municipais não são incluídos automaticamente.

Referências: [Agência Brasil — feriados 2026](https://agenciabrasil.ebc.com.br/geral/noticia/2025-12/confira-os-feriados-nacionais-e-pontos-facultativos-de-2026) e [Lei 14.759/2023 (20 de novembro)](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14759.htm).

## Avaliação

A seção recolhível Modelo experimental: calendário e feriados fica no Laboratório de Validação. Ela oferece uma prévia independente para o mês corrente, quando há base, e uma comparação de erro em meses encerrados, respeitando filtros de loja e turno.

Os testes retrospectivos usam os mesmos cortes (dias 10, 15, 20 e 25) e o mesmo realizado mensal. Ambos os motores veem apenas os lançamentos disponíveis até o dia simulado; o candidato aprende com meses estritamente anteriores. Meses incompletos ou com dados inválidos são descartados para ambos.

As medidas MAE e MAPE são agregadas pela média dentro de cada mês e depois pela média entre meses, evitando tratar cortes do mesmo mês como observações independentes. Também são contados os meses em que o candidato apresentou erro menor.

Uma eventual melhoria nos meses históricos não comprova eficácia futura. Para o TCC é necessário reservar meses posteriores ao período de desenvolvimento como teste, avaliar as previsões salvas contra fechamentos oficiais e registrar as limitações de amostra.

## Limitações

O modelo não considera feriados de Ubatuba e do estado de São Paulo, temporada turística, datas comerciais, feriados prolongados, horário das lojas ou eventos locais. Esses fatores são oportunidades de evolução, não variáveis já implementadas. O motor oficial não será substituído sem validação prospectiva e decisão explícita da gestão.
