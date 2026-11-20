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

// O mesmo mês dos anos anteriores orienta a distribuição das vendas.
// Apenas meses históricos completos, anteriores ao ano avaliado, entram no ajuste.
function fracaoHistorica({
  historicos, ano, numeroMes, lojaId, periodo, diaCorte, diasMes,
}) {
  const fracoes = [];
  for (const anoHistorico of [ano - 1, ano - 2]) {
    const prefixo = anoHistorico + "-" + String(numeroMes).padStart(2, "0") + "-";
    const diasHistoricos = new Date(anoHistorico, numeroMes, 0).getDate();
    const dias = new Map();
    let invalido = false;
    for (const venda of historicos) {
      if (!String(venda.data || "").startsWith(prefixo) ||
          String(venda.loja_id) !== String(lojaId) ||
          venda.periodo !== periodo) continue;
      const data = String(venda.data);
      const dia = Number(data.slice(8, 10));
      const valor = Number(venda.valor_vendido);
      if (!Number.isInteger(dia) || dia < 1 || dia > diasHistoricos ||
          data !== prefixo + String(dia).padStart(2, "0") ||
          venda.valor_vendido == null || !Number.isFinite(valor) || valor < 0 ||
          dias.has(dia)) {
        invalido = true;
        break;
      }
      dias.set(dia, valor);
    }
    if (invalido || dias.size !== diasHistoricos) continue;
    const total = [...dias.values()].reduce((soma, valor) => soma + valor, 0);
    const corte = Math.max(1, Math.min(diasHistoricos,
      Math.round(diaCorte * diasHistoricos / diasMes)));
    let acumulado = 0;
    for (let dia = 1; dia <= corte; dia += 1) acumulado += dias.get(dia);
    if (total > 0 && acumulado / total >= 0.05) {
      fracoes.push(acumulado / total);
    }
  }
  return fracoes.length
    ? fracoes.reduce((soma, valor) => soma + valor, 0) / fracoes.length
    : null;
}

// Projeta por loja e turno respeitando o lançamento no turno seguinte:
// a noite é registrada na manhã seguinte, e a manhã, à noite.
// Turno encerrado SEM lançamento permanece pendente, nunca venda zero.
// Não altera o registro oficial; estima apenas o saldo ainda desconhecido.
export function calcularProjecaoTurno({
  vendas = [],
  lojas = [],
  historicos = [],
  periodo,
  lojaId = null,
  contexto,
  minutosAgora = 0,
  fimTurno = 0,
}) {
  const ids = lojas
    .filter((loja) => lojaId === null || String(loja.id) === String(lojaId))
    .map((loja) => String(loja.id));
  const prefixo = `${contexto.ano}-${String(contexto.numeroMes).padStart(2, "0")}-`;
  if (contexto.tipo === "futuro" || contexto.tipo === "invalido" || !ids.length) {
    return { valor: null, media: null, diasBase: 0, pendentes: 0, sazonal: false };
  }

  const corte = Math.min(contexto.ultimoDia, Math.max(0, contexto.diaCorte));
  const abertoHoje = contexto.tipo !== "encerrado" && minutosAgora < fimTurno;
  const registros = vendas.filter((venda) => {
    if (venda.periodo !== periodo || !ids.includes(String(venda.loja_id)) ||
        !String(venda.data || "").startsWith(prefixo)) return false;
    const dia = Number(String(venda.data).slice(8, 10));
    return Number.isInteger(dia) && dia >= 1 && dia <= corte &&
      Number.isFinite(Number(venda.valor_vendido)) && venda.valor_vendido != null;
  });
  const totalVendido = registros.reduce(
    (total, venda) => total + Number(venda.valor_vendido), 0,
  );

  if (contexto.tipo === "encerrado") {
    const medias = ids.map((id) => {
      const lista = registros.filter((venda) => String(venda.loja_id) === id);
      const dias = new Set(lista.map((venda) => venda.data)).size;
      return dias > 0
        ? lista.reduce((total, venda) => total + Number(venda.valor_vendido), 0) / dias
        : null;
    });
    return {
      valor: totalVendido,
      media: medias.every((valor) => valor !== null)
        ? medias.reduce((soma, valor) => soma + valor, 0) : null,
      diasBase: new Set(registros.map((venda) => venda.data)).size,
      pendentes: 0,
      sazonal: false,
    };
  }

  let mediaTotal = 0;
  let projecaoTotal = 0;
  let pendentes = 0;
  let sazonal = false;
  let semBase = false;
  const diasBase = new Set();
  const futuros = Math.max(contexto.ultimoDia - corte, 0);

  for (const id of ids) {
    const porDia = new Map();
    for (const venda of registros) {
      if (String(venda.loja_id) !== id) continue;
      const dia = Number(String(venda.data).slice(8, 10));
      porDia.set(dia, (porDia.get(dia) || 0) + Number(venda.valor_vendido));
    }
    const diaFechado = abertoHoje ? corte - 1 : corte;
    const diasObservados = [...porDia.keys()].filter((dia) => dia <= diaFechado);
    const diasComBase = diasObservados.length;
    const fechadoVendido = diasObservados.reduce((soma, dia) => soma + porDia.get(dia), 0);
    const mediaLoja = diasComBase ? fechadoVendido / diasComBase : null;
    const vendidoLoja = [...porDia.values()].reduce((soma, valor) => soma + valor, 0);
    const pendentesLoja = Math.max(diaFechado - diasComBase, 0);

    pendentes += pendentesLoja;
    diasObservados.forEach((dia) => diasBase.add(dia));
    if (mediaLoja === null) {
      semBase = true;
      continue;
    }

    mediaTotal += mediaLoja;
    const parcialHoje = abertoHoje ? (porDia.get(corte) || 0) : 0;
    const diasEmAberto = abertoHoje && corte > 0 ? 1 : 0;
    const previsaoRitmo = vendidoLoja
      + mediaLoja * (futuros + pendentesLoja)
      + (diasEmAberto ? Math.max(0, mediaLoja - parcialHoje) : 0);
    let previsaoLoja = previsaoRitmo;

    // Sem valor parcial hoje e sem lacunas no período histórico observado.
    // Antes do dia 10, a amostra é instável: permanece somente o ritmo.
    const diaHistorico = abertoHoje ? corte - 1 : corte;
    const serieContigua = diaHistorico >= 10 && diasComBase === diaHistorico &&
      !(abertoHoje && porDia.has(corte));
    if (serieContigua && historicos.length && contexto.ultimoDia > diaHistorico &&
        previsaoRitmo > 0) {
      const fracao = fracaoHistorica({
        historicos, ano: contexto.ano, numeroMes: contexto.numeroMes,
        lojaId: id, periodo, diaCorte: diaHistorico, diasMes: contexto.ultimoDia,
      });
      if (fracao !== null) {
        const sazonalBruta = fechadoVendido / fracao;
        // Limita o peso de um ano atípico a 30% da previsão de ritmo.
        const sazonalLimitada = Math.max(previsaoRitmo * 0.7,
          Math.min(previsaoRitmo * 1.3, sazonalBruta));
        const peso = diaHistorico < 20 ? 0.5 : 0.7;
        previsaoLoja = previsaoRitmo * (1 - peso) + sazonalLimitada * peso;
        sazonal = true;
      }
    }
    projecaoTotal += previsaoLoja;
  }

  // Nunca omitir silenciosamente da projeção uma loja sem histórico.
  return {
    valor: semBase ? null : projecaoTotal,
    media: semBase ? null : mediaTotal,
    diasBase: diasBase.size,
    pendentes,
    sazonal,
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
    const porLojaTurno = ajustada !== null && lojas.length > 0
      ? ajustada / lojas.length
      : null;
    return { nome, nivel, alvo, falta, fixa, ajustada, porLojaTurno, variacao };
  });
}
