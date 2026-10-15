import { calcularMetasDiariasLoja } from "./metasImpressao.mjs";

export const NIVEIS_META_TURNO = [
  { nome: "Meta", nivel: "meta", fator: 1 },
  { nome: "Supermeta", nivel: "super", fator: 1.1 },
  { nome: "Megameta", nivel: "mega", fator: 1.2 },
];

// A projeção usa as vendas lançadas até agora, desde o primeiro dia do mês.
// Se o turno de hoje ainda não foi lançado, sua média considera até ontem.
export function calcularProjecaoTurno({
  vendas = [],
  lojas = [],
  periodo,
  lojaId = null,
  contexto,
}) {
  const lojasConsideradas = lojas.filter(
    (loja) => lojaId === null || String(loja.id) === String(lojaId),
  );
  const ids = new Set(lojasConsideradas.map((loja) => String(loja.id)));
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
    return { valor: vendido, media: null, diasBase: contexto.ultimoDia };
  }
  if (contexto.tipo === "futuro" || !ids.size) {
    return { valor: null, media: null, diasBase: 0 };
  }

  // O denominador do dia é comum ao conjunto e às lojas individuais,
  // garantindo que a projeção geral seja a soma das projeções das lojas.
  const diaAtualTemLancamento = vendas.some(
    (venda) =>
      venda.periodo === periodo &&
      lojas.some((loja) => String(loja.id) === String(venda.loja_id)) &&
      String(venda.data || "").startsWith(prefixo) &&
      Number(String(venda.data).slice(8, 10)) === contexto.diaCorte,
  );
  // Um turno sem lançamento hoje não é tratado como venda zero,
  // mesmo depois do horário de fechamento.
  const diasBase = Math.max(0, contexto.diaCorte - (diaAtualTemLancamento ? 0 : 1));
  if (!diasBase || (!registros.length && lojaId === null)) {
    return { valor: null, media: null, diasBase };
  }

  const media = vendido / diasBase;
  const valor = vendido + media * Math.max(contexto.ultimoDia - diasBase, 0);
  return { valor, media, diasBase };
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
