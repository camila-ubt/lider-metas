# Líder Metas

Aplicação web de uso interno para acompanhamento de vendas, metas, PA das vendedoras e indicadores gerenciais.

## Principais recursos

- lançamento e conferência de vendas;
- acompanhamento de metas por período, com cálculo do que falta e distribuição do esforço por loja;
- painéis, projeções e comparativos;
- conferência do PA por loja e por vendedora;
- correção de lançamentos de PA com notificação para a vendedora;
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

**v1.5.0** — Planejamento da meta por turno.

## Atualizações da v1.5.0

- mostra quanto ainda falta para a Meta nos períodos da manhã e da noite;
- calcula quantos períodos daquele turno ainda restam no mês usando os horários configurados;
- divide o valor restante pela quantidade de períodos disponíveis;
- apresenta também a divisão igual desse valor entre as lojas ativas.

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
