# Líder Metas

Aplicação web de uso interno para acompanhamento de vendas, metas, PA das vendedoras e indicadores gerenciais.

## Principais recursos

- lançamento e conferência de vendas;
- acompanhamento de metas por período, com cálculo do que falta e distribuição do esforço por loja;
- painéis, projeções e comparativos;
- conferência do PA por loja e por vendedora;
- correção e remoção de lançamentos de PA com notificação para a vendedora, sem exigir observação manual na correção;
- inclusão administrativa de lançamentos ausentes diretamente na conferência do PA, com aviso para a vendedora;
- registro administrativo de períodos de férias, com atualização automática dos dias do PA;
- aprovação e gestão de acesso das vendedoras;
- separação entre solicitações pendentes, perfis ativos e desativados;
- horários de manhã e noite compartilhados com a Calculadora de Metas;
- recuperação de senha pelo link recebido por e-mail;
- limite local de tentativas nos fluxos de login, cadastro e recuperação;
- padronização visual dos nomes das vendedoras em caixa alta;
- acesso restrito a usuários autorizados.

## Integração com a Calculadora de Metas

Os horários configurados para os períodos da manhã e da noite são mantidos no banco e compartilhados com a Calculadora de Metas. Assim, os dois sistemas usam a mesma referência de horários nos cálculos, inclusive nos dias com jornada diferente do turno normal.

## Versão atual

**v1.8.0** — Resumo gerencial de PA no painel.

## Atualizações da v1.8.0

- novo card de **Resumo de PA** no Painel, recolhido por padrão;
- no estado fechado, exibe a vendedora destaque ou uma prévia quando ainda não há 15 dias válidos;
- ao expandir, mostra PA médio geral, PA por loja, loja destaque e Top 3 de vendedoras elegíveis;
- separa as vendedoras nas faixas abaixo de 2,20, entre 2,20 e 2,59 e com 2,60 ou mais;
- compara o PA geral do mês com o mês anterior;
- gera leituras rápidas sobre loja destaque, evolução e pontos de atenção;
- nomes das vendedoras padronizados em caixa alta também no novo resumo;
- cálculo reutiliza as mesmas visões de PA já usadas na conferência, sem criar regra paralela.

## Tecnologias

Next.js, React, Supabase, Recharts e Vercel.

## Capturas de tela

### Tela de login

![Tela de login do Líder Metas](./docs/images/tela-login.png)

### Painel de desempenho

![Painel de desempenho de agosto no Líder Metas](./docs/images/dashboard-agosto.png)

### Ranking e evolução das vendas

![Ranking das lojas e evolução acumulada de agosto](./docs/images/evolucao-ranking-agosto.png)

### Lançamentos do mês

![Calendário de lançamentos de agosto](./docs/images/lancamentos-agosto.png)

### Metas cadastradas

![Metas cadastradas para agosto](./docs/images/metas-agosto.png)

## Documentação

A documentação detalhada do projeto está disponível na [Wiki do Líder Metas](https://github.com/camila-ubt/lider-metas/wiki).

## Autoria

Produzido por [@camila-ubt](https://github.com/camila-ubt).
