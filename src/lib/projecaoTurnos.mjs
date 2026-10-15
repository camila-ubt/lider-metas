import { calcularMetasDiariasLoja } from "./metasImpressao.mjs";

export const NIVEIS_META_TURNO = [
  { nome: "Meta", nivel: "meta", fator: 1 },
  { nome: "Supermeta", nivel: "super", fator: 1.1 },
  { nome: "Megameta", nivel: "mega", fator: 1.2 },
];

// O horário de fechamento define se o turno de hoje ainda entra no saldo.
export function calcularTurnosRestantes({ contexto, minutosAgora, fimTurno }) {
  if (contexto.tipo === "encerrado") return 0;
  if (contexto.tipo === "futuro") return contexto.ultimoDia;
  return Math.max(contexto.ultimoDia - contexto.diaCorte, 0) +
    (minutosAgora < fimTurno ? 1 : 0);
}

// A média usa os dias já lançados; o fechamento define se ainda falta
// executar o turno de hoje. Um dia sem lançamento não vira venda zero.
export function calcularProjecaoTurno({
  vendas = [],
  lojas = [],
  periodo,
  lojaId = null,
  contexto,
  minutosAgora = 0,
  fimTurno = 0,
}) {
  const lojasAtivas = lojas.filter(
    (loja) => lojaId === null || String(loja.id) === String(lojaId),
  );
  const ids = new Set(lojasAtivas.map((loja) => String(loja.id)));
  const todosIds = new Set(lojas.map((loja) => String(loja.id)));
  const prefixo = `${contexto.ano}-${String(contexto.numeroMes).padStart(2, "0")}-`;
  const registros = vendas.filter(
    (venda) =>
      venda.periodo === periodo &&
      ids.has(String(venda.loja_id)) &&
      String(venda.data || "").startsWith(prefixo) &&
      Number(String(venda.data).slice(8, 10)) <= contexto.diaCorte,
  );
  const vendido = registros.reduce(
    (total, venda) => total + Number(venda.valor_vendido || 0), 0,
  );

  if (contexto.tipo === "encerrado") {
    return {
      valor: vendido,
      media: contexto.ultimoDia ? vendido / contexto.ultimoDia : null,
      diasBase: contexto.ultimoDia,
    };
  }
  if (contexto.tipo === "futuro" || !ids.size) {
    return { valor: null, media: null, diasBase: 0 };
  }

  // Todas as lojas usam o mesmo divisor para que as projeções individuais
  // somem exatamente o resultado geral.
  const temLancamentoHoje = vendas.some(
    (venda) =>
      venda.periodo === periodo &&
      todosIds.has(String(venda.loja_id)) &&
      String(venda.data || "").startsWith(prefixo) &&
      Number(String(venda.data).slice(8, 10)) === contexto.diaCorte,
  );
  const diasBase = Math.max(0, contexto.diaCorte - (temLancamentoHoje ? 0 : 1));
  if (!diasBase || (!registros.length && lojaId === null)) {
    return { valor: null, media: null, diasBase };
  }

  const media = vendido / diasBase;
  const vendidoHoje = registros
    .filter((venda) => Number(String(venda.data).slice(8, 10)) === contexto.diaCorte)
    .reduce((total, venda) => total + Number(venda.valor_vendido || 0), 0);
  const diasDepoisHoje = Math.max(contexto.ultimoDia - contexto.diaCorte, 0);

  // Depois do fechamento, só entram dias futuros. Enquanto o turno de hoje
  // ainda está disponível, estima-se o saldo dele pela média observada.
  const complementoHoje = minutosAgora < fimTurno
    ? Math.max(media - vendidoHoje, 0)
    : 0;
  return {
    valor: vendido + media * diasDepoisHoje + complementoHoje,
    media,
    diasBase,
  };
}

export function somarProjecoes(...valores) {
  return valores.some((valor) => valor === null || !Number.isFinite(valor))
    ? null
    : valores.reduce((total, valor) => total + valor, 0);
}

// A meta fixa acompanha a meta impressa por loja, sem arredondar o geral
// antes de somar. A meta ajustada usa o saldo mensal e os turnos restantes.
export function calcularMetasTurno({
  metas = [],
  lojas = [],
  periodo,
  vendido = 0,
  diasMes,
  turnosRestantes,
}) {
  const metaMensal = metas
    .filter(
      (item) =>
        item.periodo === periodo &&
        lojas.some((loja) => String(loja.id) === String(item.loja_id)),
    )
    .reduce((total, item) => total + Number(item.valor_meta || 0), 0);

  return NIVEIS_META_TURNO.map(({ nome, nivel, fator }) => {
    const alvo = metaMensal * fator;
    const falta = Math.max(alvo - vendido, 0);
    const fixa = lojas.reduce((total, loja) => {
      const linha = calcularMetasDiariasLoja({
        metas, lojaId: loja.id, totalDias: diasMes,
      }).find((item) => item.sigla === (periodo === "manha" ? "M" : "N"));
      return total + Number(linha?.[nivel] || 0);
    }, 0);
    const ajustada = turnosRestantes > 0 ? falta / turnosRestantes : null;
    const variacao = ajustada !== null && fixa > 0
      ? ((ajustada / fixa) - 1) * 100
      : null;
    return { nome, nivel, alvo, falta, fixa, ajustada, variacao };
  });
}
