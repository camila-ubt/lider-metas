## v1.6.0 — Inclusão de lançamentos pela gestão

Publicada em **28 de setembro de 2026**.

Esta versão permite completar lançamentos ausentes durante a conferência do PA, sem precisar acessar a conta da vendedora.

### Novo fluxo na conferência

- o botão **Adicionar lançamento** fica no resumo da vendedora, acima dos cartões das lojas;
- a gestão escolhe a loja, a data, a quantidade de vendas e a quantidade de peças;
- o lançamento é gravado no mesmo banco usado pelo Cálculo PA e passa a aparecer para a vendedora;
- a tela atualiza os totais por loja e o detalhamento diário depois da inclusão;
- se já houver lançamento para a mesma loja e data, o sistema orienta usar **Corrigir**.

### Validações e segurança

- somente perfis ativos de administração ou gestão podem usar a nova operação;
- vendas e peças aceitam apenas números inteiros de 0 a 999;
- a quantidade de peças não pode ser menor que a de vendas;
- datas já marcadas como férias, folga, falta, atestado ou não trabalhado não são alteradas automaticamente;
- somente lojas ativas podem receber novos lançamentos;
- um novo lançamento invalida uma aprovação anterior daquela loja no mês, exigindo nova conferência.

### Documentação

A Wiki, o README e o rodapé do aplicativo foram atualizados para a v1.6.0.
