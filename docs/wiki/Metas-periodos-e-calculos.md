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

Depois do encerramento de um período, o dia atual deixa de contar como oportunidade para ele. A configuração é mantida no perfil e sincronizada com o navegador.

## Projeção

A projeção básica considera o ritmo médio dos dias observados e o estende até o final do mês. Análises complementares podem considerar variação diária, tendência e faixa estimada.

## Referência oficial

A regra oficial deste projeto é **100% / 110% / 120%**. Se alguma tela exibir percentuais diferentes, trate como inconsistência de interface e registre uma revisão antes de usar o número em uma decisão.
