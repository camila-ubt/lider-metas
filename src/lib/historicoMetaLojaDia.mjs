// Reconstrói a meta ajustada por loja/dia a partir das vendas já lançadas.
// Dias encerrados usam o saldo após as vendas do dia e apenas os dias seguintes.
// O dia atual usa os mesmos dias restantes do card, que pode incluir hoje.
export function gerarHistoricoMetaLojaDia({
  vendas = [],
  metaMensal,
  quantidadeLojas,
  totalDias,
  diaCorte,
  mesAtual = false,
  diasRestantesAtual = 0,
}) {
  const meta = Number(metaMensal);
  const lojas = Number(quantidadeLojas);
  const dias = Number(totalDias);
  const corte = Math.min(dias, Math.max(0, Number(diaCorte) || 0));

  if (!(meta > 0) || !(lojas > 0) || !Number.isInteger(dias) || dias < 1) {
    return [];
  }

  const vendasPorDia = Array(dias + 1).fill(0);
  for (const venda of vendas) {
    const dia = Number(String(venda.data || "").slice(8, 10));
    const valor = Number(venda.valor_vendido || 0);
    if (Number.isInteger(dia) && dia >= 1 && dia <= dias && Number.isFinite(valor)) {
      vendasPorDia[dia] += valor;
    }
  }

  const niveis = [
    { nome: "Meta", valor: meta },
    { nome: "Supermeta", valor: meta * 1.1 },
    { nome: "Megameta", valor: meta * 1.2 },
  ];

  let acumulado = 0;
  const historico = [];

  for (let dia = 1; dia <= corte; dia += 1) {
    acumulado += vendasPorDia[dia];
    const alvo = niveis.find((nivel) => acumulado < nivel.valor) || null;
    const diasRestantes = mesAtual && dia === corte
      ? Math.max(0, Number(diasRestantesAtual) || 0)
      : dias - dia;

    const necessario = alvo && diasRestantes > 0
      ? (alvo.valor - acumulado) / (diasRestantes * lojas)
      : null;
    const fixa = alvo ? alvo.valor / (dias * lojas) : null;
    // A linha do gráfico representa o desvio percentual em relação à meta
    // fixa da mesma etapa. A mudança entre dias é medida em pontos percentuais.
    const desvioPercentual = necessario !== null && fixa > 0
      ? Number(((necessario / fixa - 1) * 100).toFixed(1))
      : null;
    const anterior = historico.at(-1);
    const mudouNivel = Boolean(anterior && anterior.nivel !== (alvo?.nome || "Megameta conquistada"));
    const variacaoPp = anterior && !mudouNivel
      && anterior.desvioPercentual !== null && desvioPercentual !== null
      ? Number((desvioPercentual - anterior.desvioPercentual).toFixed(1))
      : null;

    historico.push({
      dia,
      vendidoDia: vendasPorDia[dia],
      acumulado,
      diasRestantes,
      nivel: alvo ? alvo.nome : "Megameta conquistada",
      concluida: !alvo,
      necessario,
      fixa,
      desvioPercentual,
      variacaoPp,
      mudouNivel,
    });
  }

  return historico;
}
