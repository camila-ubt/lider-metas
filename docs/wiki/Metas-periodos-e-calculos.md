# Metas, períodos e cálculos

## Cadastro das metas

As metas são mensais e separadas por loja e período. A meta total de uma loja é a soma das metas de seus períodos; a meta geral é a soma de todas as lojas ativas.

Somente perfis administrativos visualizam e alteram a área **Metas**.

## Níveis

Para uma Meta base `M`:

- Meta = `M`;
- Supermeta = `M × 1,10`;
- Megameta = `M × 1,20`.

O percentual realizado é calculado por `vendido ÷ meta × 100`.

## Quanto falta

Para o próximo nível ainda não atingido:

`falta = máximo(alvo − vendido, 0)`

Quando há oportunidades restantes:

`necessidade média = falta ÷ oportunidades restantes`

Cada loja e período possui seus próprios valores. Por isso, um período pode atingir um nível diferente do total combinado.

## Planejamento por turno

A partir da **v1.5.0**, o painel de reunião detalha também o esforço restante para a Meta de cada turno.

Para manhã e noite, o sistema apresenta:

- quanto ainda falta para a Meta daquele período;
- quantos períodos daquele turno ainda restam no mês;
- quanto precisa ser vendido, em média, em cada período restante;
- quanto desse valor corresponderia a cada loja ativa se a necessidade fosse dividida igualmente.

As referências são calculadas assim:

`necessário por período = falta para a Meta ÷ períodos restantes`

`necessário por loja/período = necessário por período ÷ lojas ativas`

A contagem respeita os horários configurados. Depois do encerramento da manhã, o dia atual não entra mais como manhã disponível. Enquanto a noite ainda não terminou, a noite do próprio dia continua entrando na conta.

Esses valores servem como referência de planejamento. Eles não alteram metas nem lançamentos já registrados.

## Impressão das metas diárias

A partir da **v1.9.0**, a gestão pode usar o botão **Imprimir metas** para gerar o quadro diário das lojas no mesmo formato do controle físico.

O sistema usa o mês selecionado e calcula, para cada loja:

- **M**: manhã;
- **N**: noite;
- **T**: total da loja;
- **Meta Dia**: 100%;
- **Super Dia**: 110%;
- **Mega Dia**: 120%.

A referência diária é obtida dividindo a meta mensal correspondente pela quantidade de dias do mês. Supermeta e Megameta seguem a regra oficial de 110% e 120%. Para manter o formato usado na impressão física, os valores são exibidos em reais inteiros.

A impressão é preparada para bobina de **80 mm** e gera um quadro para cada loja ativa, em sequência. Essa função apenas apresenta os valores para impressão e não altera as metas cadastradas.

## Contexto do mês

### Mês futuro

Todos os dias são tratados como oportunidades. Ainda não existe dia de corte para análise do realizado.

### Mês em andamento

O sistema usa os lançamentos até o dia atual e considera os dias e períodos ainda disponíveis.

### Último dia

O dia permanece disponível apenas enquanto o horário final do período não tiver passado.

### Mês encerrado

Não existem oportunidades restantes. O aplicativo apresenta o resultado final e, quando um nível não foi atingido, a diferença equivalente por dia do mês.

## Horários dos períodos

Os horários definem quando cada período começa e termina. As regras impedem término anterior ao início e sobreposição entre períodos.

A partir da **v1.3.0**, essa configuração é mantida de forma compartilhada no banco de dados. O Líder Metas e a Calculadora de Metas consultam os mesmos horários de manhã e noite. Quando uma administradora altera essa configuração no Líder Metas, os dois sistemas passam a utilizar a nova referência.

A leitura da configuração é disponibilizada aos sistemas integrados, enquanto a alteração permanece restrita aos perfis administrativos autorizados.

Depois do encerramento de um período, o dia atual deixa de contar como oportunidade para ele. Na Calculadora de Metas, os mesmos horários também servem de referência para o cálculo proporcional dos dias com jornada diferente do turno normal.

## Projeção

A projeção básica considera o ritmo médio dos dias observados e o estende até o final do mês. Análises complementares podem considerar variação diária, tendência e faixa estimada.

## Referência oficial

A regra oficial deste projeto é **100% / 110% / 120%**. Se alguma tela exibir percentuais diferentes, trate como inconsistência de interface e registre uma revisão antes de usar o número em uma decisão.
