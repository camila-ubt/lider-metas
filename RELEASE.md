## v1.5.0 — Planejamento da meta por turno

Publicada em **28 de setembro de 2026**.

Esta versão amplia a leitura dos períodos da manhã e da noite no painel de reunião, deixando mais claro o esforço necessário para atingir a Meta até o fim do mês.

### Planejamento por turno

- mostra quanto ainda falta para a Meta de cada período;
- informa quantas manhãs ou noites ainda restam no mês;
- calcula quanto precisa ser vendido, em média, em cada período restante;
- divide esse valor igualmente entre as lojas ativas para mostrar uma referência por loja e por período;
- quando a Meta do turno já foi atingida, o painel informa essa situação diretamente.

### Regra de tempo

- o dia atual deixa de contar para a manhã depois do horário final configurado para esse período;
- a noite do dia atual continua sendo considerada enquanto o horário final da noite ainda não tiver passado;
- meses encerrados não possuem períodos restantes.

### Regras preservadas

- as metas cadastradas e os lançamentos de vendas não são alterados por esse cálculo;
- Meta, Supermeta, Megameta, PA e demais indicadores continuam com as regras existentes;
- a mudança é apenas de leitura e planejamento no painel gerencial.
