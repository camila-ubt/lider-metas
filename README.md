# Líder Metas

Aplicação web de uso interno para acompanhamento de vendas, metas, PA das vendedoras e indicadores gerenciais.

## Principais recursos

- lançamento e conferência de vendas;
- acompanhamento de metas por período, com cálculo do que falta e distribuição do esforço por loja;
- impressão das metas diárias de Meta, Supermeta e Megameta por loja em bobina de 80 mm;
- painéis, projeções e comparativos;
- conferência do PA por loja e por vendedora;
- correção e remoção de lançamentos de PA com notificação para a vendedora, sem exigir observação manual na correção;
- inclusão administrativa de lançamentos ausentes diretamente na conferência do PA, com aviso para a vendedora;
- registro administrativo de períodos de férias, com atualização automática dos dias do PA;
- fechamento mensal do PA após a conferência, com bloqueio de alterações e reabertura restrita a administradoras;
- fechamento manual de cada mês de vendas após o último dia estar completo, mantendo o mês fechado somente para consulta;
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

**v1.13.0** — Fechamento mensal das vendas.

## Atualizações da v1.13.0

Novo botão **Fechar mês** em **Lançar vendas**. Ele é liberado quando o mês chegou ao último dia e os lançamentos de manhã e noite de todas as lojas estão preenchidos nesse dia. O fechamento é manual, afeta somente o mês selecionado e mantém os dados disponíveis para consulta, sem permitir novas alterações.

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
