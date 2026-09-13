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
