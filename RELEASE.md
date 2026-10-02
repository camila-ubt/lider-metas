## v1.9.0 — Impressão das metas diárias

Publicada em **2 de outubro de 2026**.

Esta versão adiciona ao Líder Metas a impressão do quadro diário de metas usado nas lojas, aproveitando os valores mensais que já estão cadastrados no sistema.

### Impressão em 80 mm

- novo botão **Imprimir metas** ao lado do seletor de mês;
- geração de um quadro para cada loja ativa;
- layout preparado para bobina de **80 mm**, compatível com a configuração de papel 80 × 297 mm;
- pré-visualização antes de enviar para a impressora;
- as três lojas são impressas em sequência para facilitar o corte e a distribuição.

### Valores impressos

Cada quadro mostra:

- **M**: meta diária da manhã;
- **N**: meta diária da noite;
- **T**: meta diária total da loja;
- **Meta Dia**: 100% da meta;
- **Super Dia**: 110% da meta;
- **Mega Dia**: 120% da meta.

Os valores são calculados automaticamente a partir das metas mensais da loja e do número de dias do mês. O resultado diário é apresentado em reais inteiros, mantendo o padrão do controle físico já utilizado.

### Segurança e dados

- nenhuma migration nova;
- nenhuma alteração nas metas cadastradas;
- a impressão fica disponível para perfis de gestão;
- os cálculos possuem teste automatizado com o formato esperado do quadro.

### Documentação

README, Wiki, release, versão do pacote e rodapés foram atualizados para a v1.9.0.
