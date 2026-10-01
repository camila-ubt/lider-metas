## v1.8.0 — Resumo gerencial de PA no painel

Publicada em **1º de outubro de 2026**.

Esta versão leva os principais indicadores de PA para o Painel do Líder Metas sem deixar a tela carregada. O novo card fica recolhido por padrão e pode ser aberto quando a gestão quiser aprofundar a leitura do mês.

### Resumo recolhível

- novo card **Resumo de PA** no Painel;
- o card inicia fechado por padrão;
- no estado recolhido, mostra a vendedora destaque do mês;
- quando nenhuma vendedora atingiu 15 dias válidos, a maior PA disponível aparece identificada como prévia;
- nomes das vendedoras aparecem padronizados em caixa alta.

### Indicadores ao expandir

- PA médio geral do mês;
- PA consolidado por loja;
- loja com maior PA;
- vendedora destaque considerando o mínimo de 15 dias válidos;
- Top 3 de vendedoras elegíveis;
- quantidade de vendedoras abaixo de 2,20, entre 2,20 e 2,59 e com 2,60 ou mais;
- comparação do PA geral com o mês anterior;
- insights rápidos sobre destaque, faixa de PA e evolução mensal.

### Dados e regras

- o painel reutiliza as visões `resumo_pa_mensal` e `resumo_pa_mensal_loja`;
- não há nova migration;
- nenhuma regra existente de cálculo, premiação ou conferência do PA foi alterada;
- o destaque oficial continua respeitando o mínimo de 15 dias válidos.

### Documentação

A Wiki, o README, a release, a versão do pacote e os rodapés do aplicativo e da Wiki foram atualizados para a v1.8.0.
