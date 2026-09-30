## v1.7.0 — Férias na gestão do PA

Publicada em **30 de setembro de 2026**.

Esta versão melhora a administração do PA em dois pontos: perfis desativados deixam de aparecer no resumo mensal e a gestão passa a registrar períodos de férias sem precisar acessar a conta da vendedora.

### Resumo do mês

- o resumo mensal passa a considerar somente vendedoras ativas;
- desativar um perfil não apaga o histórico existente no banco;
- ao reativar a vendedora, os dados históricos continuam disponíveis normalmente.

### Registro de férias

- novo botão **Registrar férias** no resumo da vendedora;
- a gestão informa a data de início e a data de fim;
- o período pode incluir datas futuras e atravessar meses;
- cada dia do intervalo é marcado como `ferias` no mesmo banco usado pelo Cálculo PA;
- dias de férias não contam como dias trabalhados nem entram no cálculo do PA;
- antes de salvar, o sistema confirma a operação e avisa que lançamentos existentes no intervalo serão removidos;
- quando existem lançamentos no período, eles são removidos e as aprovações correspondentes são invalidadas automaticamente;
- a operação aceita no máximo 62 dias por vez para reduzir o risco de seleção acidental de um intervalo muito grande.

### Segurança

- somente perfis ativos de administração ou gestão podem registrar férias;
- o período só pode ser aplicado a uma vendedora ativa;
- a gravação é feita por função protegida no banco;
- validações de intervalo e permissões também são executadas no servidor.

### Documentação

A Wiki, o README, a release e os rodapés do aplicativo e da Wiki foram atualizados para a v1.7.0.
