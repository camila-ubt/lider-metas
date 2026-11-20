# Como funciona

## Fluxo mensal

A gestão seleciona o mês desejado e acompanha os lançamentos de vendas das lojas.

Cada dia possui lançamentos separados por loja e período. A equipe da manhã registra a noite anterior e a equipe da noite registra a manhã do mesmo dia, sempre usando a **data em que a venda ocorreu**. O calendário indica o que já foi preenchido e o que ainda está pendente.

Depois dos lançamentos, o painel consolida os valores e compara o realizado com as metas cadastradas.

## Metas

As metas são cadastradas por loja e período.

A aplicação calcula os níveis usados no acompanhamento mensal e apresenta o desempenho consolidado por loja, período e total geral.

Os horários de manhã e noite são compartilhados com a Calculadora de Metas para que os dois sistemas utilizem a mesma referência.

## Acompanhar turno

Em **Lançar vendas**, o botão **Acompanhar turno** abre a consulta do turno de hoje, sem fazer lançamentos oficiais. A consulta acompanha manhã ou noite nas faixas Meta, Supermeta e Megameta. A meta ajustada usa o saldo mensal após as vendas oficiais anteriores e os turnos restantes. A meta fixa aparece como referência.

As vendas informadas durante o turno atualizam o valor restante por loja e no geral, com compensação entre lojas, e permitem prever as metas de amanhã. Os valores ficam salvos apenas no aparelho até serem limpos: não preenchem os caixas do calendário nem alteram lançamentos oficiais.

## Painel e Roteiro da Reunião

Nos cards de **Manhã** e **Noite**, a barra segue a proporção real das vendas em relação à Megameta mensal, com os marcos de Meta e Supermeta nas posições matemáticas correspondentes e sem porcentagens escritas na interface. O valor vendido é exibido em fonte maior que o valor da meta. Acima da barra aparece apenas a **meta mensal atual** (Meta, Supermeta ou Megameta) e seu valor cheio, somado entre as lojas. Abaixo, aparecem o **vendido do mês** e **quanto falta para o nível atual**, ou o excedente após atingir a Megameta. Enquanto há turnos, o saldo indica o valor necessário **por loja/turno restante**; ao terminar o período, mostra quanto cada loja teria precisado vender **a mais por dia**, considerando os dias do mês. Em meses encerrados, exibe a meta mensal original e trata o saldo faltante no passado. As três colunas de **Meta, Supermeta e Megameta diárias** permanecem separadas, com meta ajustada, porcentagem versus a meta fixa e valor por loja/turno. O Painel destaca o menor desempenho entre lojas e períodos; o Roteiro da Reunião também compara manhã e noite em relação à meta.

## Inteligência Gerencial

O Painel usa uma única projeção de fechamento calculada por loja e turno. Um turno encerrado sem registro é tratado como pendente e estimado provisoriamente pela média das vendas já lançadas; não vira venda zero. Com histórico completo do mesmo mês de anos anteriores, o cálculo incorpora um ajuste sazonal conservador a partir do dia 10. Quando os dados históricos faltam, usa somente o ritmo das vendas atuais. A análise histórica continua comparando anos e dias da semana. Na Inteligência Gerencial, as chances aproximadas de Meta, Supermeta e Megameta são estimadas com base no ritmo acumulado em relação às metas e nos meses encerrados dos dois anos anteriores. A comparação dá mais peso ao mesmo mês de cada ano disponível (um ou dois anos) e também considera outros meses com ritmos parecidos. Exige pelo menos seis meses completos e amostra estatística mínima, arredonda as chances em passos de 5% e mantém a indicação indisponível quando faltam dados. São estimativas históricas, não garantias. O laboratório mantém a comparação simples entre as previsões das datas de referência e o fechamento real; os valores de meses passados constituem simulações retrospectivas, não registros das previsões feitas naquela época.

## PA das vendedoras

A área de PA permite à gestão conferir os dados enviados pelo sistema de Cálculo PA.

Em **Totais por loja**, além de adicionar vendas e registrar férias, a gestão pode usar **Marcar dia não trabalhado** para informar uma folga ou ausência em uma data do mês selecionado. Não é preciso selecionar loja ou preencher vendas e peças. O dia passa a constar no PA da vendedora sem contar como trabalhado, inclusive quando é o último dia do mês e permite a apuração da premiação. Um registro com vendas, férias ou de mês já fechado não é sobrescrito.

É possível consultar resultados por vendedora e loja, aprovar lançamentos, corrigir dados, registrar férias e acompanhar a situação mensal.

O fechamento do PA é independente do fechamento das vendas.

## Fechamento do mês

Depois de preencher o último dia do mês e conferir os totais com o demonstrativo da loja, a gestão pode usar **Fechar mês**.

O fechamento afeta somente o mês selecionado.

Depois disso:

- os valores continuam visíveis para consulta;
- vendas e metas daquele mês não podem mais ser alteradas;
- os demais meses continuam independentes.

A proteção existe tanto na interface quanto no banco de dados.

## Perfis de acesso

O sistema diferencia usuários operacionais e perfis de gestão.

A interface mostra apenas as funções permitidas para cada perfil, e o banco repete essas restrições com autenticação, permissões e políticas de acesso.
