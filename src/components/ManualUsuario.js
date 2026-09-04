"use client";

import styles from "./ManualUsuario.module.css";

const secoes = [
  {
    titulo: "Visão geral e navegação",
    itens: [
      ["Para que serve cada aba?", [
        "Painel: acompanha o resultado geral, das lojas e dos períodos.",
        "Lançar vendas: registra, consulta e corrige os valores diários.",
        "Metas: área administrativa para cadastrar metas e configurar horários.",
        "Manual do usuário: reúne as regras e respostas para as principais dúvidas do aplicativo.",
      ]],
      ["Como escolher outro mês?", [
        "Use o seletor de mês no topo da tela. Todo o aplicativo passa a considerar o mês escolhido.",
        "Use o botão “Mês atual” para retornar rapidamente ao mês corrente.",
      ]],
      ["Os meses anteriores ficam salvos?", [
        "Sim. Vendas e metas são armazenadas por mês e podem ser consultadas novamente pelo seletor de mês.",
      ]],
      ["O que fazer quando uma informação parece desatualizada?", [
        "Atualize a página. No computador, use Ctrl + F5. Antes de lançar novamente, confira se o registro já aparece para evitar duplicidade.",
      ]],
    ],
  },
  {
    titulo: "Aba Painel",
    itens: [
      ["O que mostra a Jornada do mês?", [
        "Mostra o total vendido, o nível alcançado ou perseguido e a situação de Meta, Supermeta e Megameta.",
        "Em mês em andamento, os cards mostram quanto falta no total e quanto seria necessário por dia restante.",
        "Em mês encerrado, mostram quanto faltou no total e a média por dia daquele mês.",
      ]],
      ["Qual é a diferença entre Meta, Supermeta e Megameta?", [
        "Meta corresponde a 100% do valor cadastrado.",
        "Supermeta corresponde a 120% da Meta.",
        "Megameta corresponde a 130% da Meta.",
      ]],
      ["O que significa projeção?", [
        "É uma estimativa do fechamento do mês baseada no ritmo médio das vendas já lançadas. Não é uma garantia de resultado.",
      ]],
      ["Como funciona o Ranking interativo?", [
        "As lojas são ordenadas pelo percentual da Meta atingido.",
        "Toque em uma loja para abrir o total vendido, projeção ou resultado final e os detalhes de Meta, Supermeta e Megameta da loja, da manhã e da noite.",
      ]],
      ["O que significam os valores por dia dentro do ranking?", [
        "Mostram quanto ainda precisa ser vendido, em média, nas oportunidades restantes daquele nível, loja ou período.",
        "No mês encerrado, mostram quanto teria sido necessário por dia do mês para alcançar o nível que não foi atingido.",
      ]],
      ["O que mostra o gráfico de Evolução acumulada?", [
        "Realizado: soma das vendas dia após dia.",
        "Projeção: continuidade estimada do ritmo atual.",
        "Meta, Supermeta e Megameta: trajetórias acumuladas esperadas até o fim do mês.",
      ]],
      ["Como interpretar o Comparativo histórico?", [
        "Compara o mês selecionado com o mesmo mês dos anos anteriores até o mesmo dia de corte.",
        "Use os filtros para consultar todas as lojas, uma loja específica, todos os períodos, manhã ou noite.",
      ]],
      ["O que são os Insights automáticos?", [
        "São observações geradas a partir dos lançamentos, metas, liderança das lojas, períodos e comparação histórica.",
        "Eles ajudam na leitura do resultado, mas não substituem a conferência dos valores lançados.",
      ]],
      ["Por que um período pode bater Megameta e o total ficar em Supermeta?", [
        "Cada período e cada loja têm cálculos próprios. Um período pode atingir 130% enquanto outro fica abaixo, fazendo o total combinado permanecer entre 120% e 129,9%.",
      ]],
    ],
  },
  {
    titulo: "Aba Lançar vendas",
    itens: [
      ["Como lançar as vendas do dia?", [
        "Abra “Lançar vendas”, toque no dia, escolha o período e a loja, informe o valor vendido e salve.",
        "Cada dia pode ter até seis lançamentos: manhã e noite das três lojas.",
      ]],
      ["O que significam M e N no calendário?", [
        "M representa manhã e N representa noite.",
        "Eles ficam verdes quando todas as lojas daquele período foram preenchidas. Valores zerados também contam como preenchidos.",
      ]],
      ["O que significa dia completo, parcial ou pendente?", [
        "Completo: todos os lançamentos esperados foram preenchidos.",
        "Parcial: há pelo menos um lançamento, mas ainda falta alguma loja ou período.",
        "Pendente: nenhum lançamento ou algum período obrigatório continua faltando.",
      ]],
      ["Como corrigir um valor já lançado?", [
        "Toque novamente no dia, abra a aba “Lançados”, escolha a loja e o período, altere o valor e salve.",
        "Também é possível abrir diretamente o dia pelo ícone de edição na Conferência com o Athos.",
      ]],
      ["O que fazer quando o caixa não abriu?", [
        "Use “Marcar caixa não aberto”. O sistema registra valor zero com a observação adequada e considera o período preenchido.",
      ]],
      ["Por que a janela mostra pendências de outros dias?", [
        "Na aba Pendentes, o sistema mostra os períodos faltantes desde a data selecionada até hoje, sem ultrapassar o mês escolhido.",
        "Na aba Lançados, mostra somente os lançamentos do dia e da loja selecionados.",
      ]],
      ["Posso lançar valor zero manualmente?", [
        "Sim, mas use zero somente quando realmente não houve venda ou o caixa não abriu. Sempre confira a observação.",
      ]],
      ["Como remover um lançamento incorreto?", [
        "Abra o lançamento já salvo e use a opção de remoção disponível no modal. Depois, confira se o dia voltou a aparecer como pendente.",
      ]],
    ],
  },
  {
    titulo: "Aba Metas — administradoras",
    itens: [
      ["Como cadastrar ou editar uma meta?", [
        "Escolha o mês no topo, abra a aba Metas e toque no card da loja e do período desejados.",
        "Informe a Meta de 100%. Supermeta e Megameta são calculadas automaticamente em 120% e 130%.",
      ]],
      ["As metas são separadas por loja e período?", [
        "Sim. Cada loja possui uma meta de manhã e uma meta de noite. A meta total da loja é a soma dos dois períodos.",
      ]],
      ["O que significa meta pendente?", [
        "Significa que ainda não existe valor cadastrado para aquela combinação de loja, período e mês.",
      ]],
      ["Como alterar os horários dos períodos?", [
        "Na própria aba Metas, abra “Configuração dos períodos”, altere início e término da manhã e da noite e salve.",
      ]],
      ["Para que os horários são usados?", [
        "Eles definem quando o dia atual ainda conta como oportunidade para cada período.",
        "Depois do término da manhã, o dia atual deixa de entrar no cálculo diário da manhã. A noite continua contando até o término configurado.",
      ]],
      ["A configuração de horários fica salva?", [
        "Sim. Ela fica associada ao perfil e continua disponível ao acessar por outro dispositivo.",
      ]],
    ],
  },
  {
    titulo: "Conferência com o Athos",
    itens: [
      ["Para que serve a conferência?", [
        "Serve para comparar os valores diários do aplicativo com o relatório Athos e identificar rapidamente diferenças de lançamento.",
      ]],
      ["Como corrigir um dia que não bate?", [
        "Use o ícone de lápis ao lado do dia. O aplicativo abre diretamente os lançamentos daquela data e da loja selecionada.",
      ]],
      ["Por que é importante conferir antes de analisar o painel?", [
        "Projeções, ranking, médias, metas e insights dependem dos lançamentos. Um valor incorreto altera todas essas leituras.",
      ]],
    ],
  },
  {
    titulo: "Cálculos de dias e períodos",
    itens: [
      ["Como é calculado o valor que falta por dia?", [
        "O sistema subtrai o vendido do valor do nível e divide o restante pelas oportunidades que ainda existem.",
        "Para manhã e noite, usa separadamente os dias ainda disponíveis de cada período.",
      ]],
      ["O dia atual sempre entra no cálculo?", [
        "Não. Ele entra apenas enquanto o período ainda não terminou.",
        "Depois do horário final da manhã, hoje deixa de contar para a manhã. Depois do horário final da noite, hoje deixa de contar para a noite e para o fechamento geral do dia.",
      ]],
      ["Como funciona em mês futuro?", [
        "Todos os dias do mês são considerados disponíveis, pois ainda não houve encerramento de nenhum período.",
      ]],
      ["Como funciona em mês encerrado?", [
        "Não há dias restantes. O aplicativo informa quanto faltou para cada nível e divide essa diferença pelo total de dias daquele mês para mostrar a média diária equivalente.",
      ]],
      ["Por que o valor por dia da manhã pode ser diferente do valor por dia da noite?", [
        "Porque cada período possui meta, vendas acumuladas e quantidade de oportunidades restantes próprias.",
      ]],
    ],
  },
  {
    titulo: "Boas práticas e solução de problemas",
    itens: [
      ["Qual é a ordem recomendada de uso?", [
        "1. Conferir o mês selecionado.",
        "2. Lançar ou corrigir todas as lojas e períodos.",
        "3. Conferir com o Athos.",
        "4. Só depois analisar Painel, ranking, projeções e insights.",
      ]],
      ["O que fazer se uma loja ou período não aparecer?", [
        "Confira o mês selecionado e atualize a página. Se persistir, verifique se a loja está ativa e se a meta do período foi cadastrada.",
      ]],
      ["O que fazer se o total do painel não bater com o Athos?", [
        "Revise os dias na Conferência com o Athos, procurando diferenças por loja e período. Use o lápis para abrir e corrigir diretamente o lançamento divergente.",
      ]],
      ["Posso confiar na projeção com lançamentos pendentes?", [
        "Não totalmente. A projeção usa os dados disponíveis. Pendências ou valores incorretos podem reduzir ou aumentar artificialmente o resultado projetado.",
      ]],
      ["Quem pode alterar metas e horários?", [
        "Somente perfis com permissão de administradora visualizam a aba Metas e essas configurações.",
      ]],
    ],
  },
];

export default function ManualUsuario() {
  return (
    <section className={styles.manual} data-manual-usuario>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>Ajuda e referência</p>
        <h2>Manual do usuário</h2>
        <p className={styles.intro}>
          Consulte aqui como usar cada aba, interpretar os cálculos e resolver as dúvidas mais comuns do Líder Metas.
        </p>
        <div className={styles.quick}>
          <article><strong>Antes de analisar</strong><span>Confira mês, lançamentos e relatório Athos.</span></article>
          <article><strong>Antes de corrigir</strong><span>Confirme loja, data e período selecionados.</span></article>
          <article><strong>Valores por dia</strong><span>Respeitam os dias e horários restantes de cada período.</span></article>
        </div>
      </div>

      <div className={styles.sections}>
        {secoes.map((secao) => (
          <section className={styles.group} key={secao.titulo}>
            <h3>{secao.titulo}</h3>
            {secao.itens.map(([pergunta, respostas]) => (
              <details key={pergunta}>
                <summary>{pergunta}</summary>
                <div className={styles.answer}>
                  {respostas.map((resposta) => <p key={resposta}>{resposta}</p>)}
                </div>
              </details>
            ))}
          </section>
        ))}
      </div>

      <div className={styles.notice}>
        Antes de tomar uma decisão pelo painel, confirme se todos os lançamentos do período foram preenchidos corretamente.
      </div>
    </section>
  );
}
