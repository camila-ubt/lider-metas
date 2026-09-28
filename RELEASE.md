## v1.6.0 — Gestão de lançamentos do PA

Publicada em **28 de setembro de 2026**.

Esta versão amplia a conferência do PA para que a gestão possa completar lançamentos ausentes e remover registros incorretos ou duplicados sem acessar a conta da vendedora.

### Novo fluxo na conferência

- o botão **Adicionar lançamento** fica no resumo da vendedora, acima dos cartões das lojas;
- a gestão escolhe a loja, a data, a quantidade de vendas e a quantidade de peças;
- o lançamento é gravado no mesmo banco usado pelo Cálculo PA e passa a aparecer para a vendedora;
- um aviso é registrado para ela com a data, a loja e a informação de que o lançamento foi adicionado pela gestão;
- a tela atualiza os totais por loja e o detalhamento diário depois da inclusão;
- se já houver lançamento para a mesma loja e data, o sistema orienta usar **Corrigir**;
- no detalhamento diário, cada registro passa a ter também a opção **Remover**;
- a correção deixa de exigir motivo digitado manualmente, pois o aviso já mostra os valores anteriores e os novos;
- a remoção pede confirmação, retira o registro dos cálculos e gera um aviso para a vendedora;
- se o lançamento removido era o único daquele dia, a data deixa de contar como dia válido no PA; se havia outra loja no mesmo dia, somente a loja escolhida é removida.

### Validações e segurança

- somente perfis ativos de administração ou gestão podem usar a nova operação;
- vendas e peças aceitam apenas números inteiros de 0 a 999;
- a quantidade de peças não pode ser menor que a de vendas;
- datas já marcadas como férias, folga, falta, atestado ou não trabalhado não são alteradas automaticamente;
- somente lojas ativas podem receber novos lançamentos;
- inclusão, correção ou remoção invalidam uma aprovação anterior da loja no mês, exigindo nova conferência;
- a remoção valida os valores atuais antes de excluir, evitando apagar um registro que mudou desde a abertura da tela.

### Documentação

A Wiki, o README e o rodapé do aplicativo foram atualizados para a v1.6.0.
