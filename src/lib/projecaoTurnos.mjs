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

// A média se baseia somente nos dias com lançamento de cada loja.
// O horário determina se hoje ainda é um turno restante; lançamento e
// horário nunca são confundidos com venda zero.
export function calcularProjecaoTurno({
  vendas = [],
  lojas = [],
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
  const registros = vendas.filter(
    (venda) =>
      venda.periodo === periodo &&
      ids.includes(String(venda.loja_id)) &&
      String(venda.data || "").startsWith(prefixo) &&
      Number(String(venda.data).slice(8, 10)) <= contexto.diaCorte,
  );

  const totalVendido = registros.reduce(
    (total, venda) => total + Number(venda.valor_vendido || 0), 0,
  );

  if (contexto.tipo === "futuro" || !ids.length) {
    return { valor: null, media: null, diasBase: 0 };
  }

  const diaAtual = `${prefixo}${String(contexto.diaCorte).padStart(2, "0")}`;
  const diasFuturos = Math.max(contexto.ultimoDia - contexto.diaCorte, 0);
  const turnoAberto = contexto.tipo !== "encerrado" && minutosAgora < fimTurno;
  let mediaTotal = 0;
  let projecaoTotal = 0;
  const diasBase = new Set();

  for (const id of ids) {
    const registrosLoja = registros.filter(
      (venda) => String(venda.loja_id) === id,
    );
    const vendidoLoja = registrosLoja.reduce(
      (total, venda) => total + Number(venda.valor_vendido || 0), 0,
    );
    const vendasBase = turnoAberto
      ? registrosLoja.filter((venda) => venda.data !== diaAtual)
      : registrosLoja;
    const diasDaLoja = new Set(vendasBase.map((venda) => venda.data));
    diasDaLoja.forEach((data) => diasBase.add(data));

    // Um lançamento parcial de hoje entra no realizado, mas nunca reduz
    // a média de turnos já encerrados.
    const mediaLoja = diasDaLoja.size
      ? vendasBase.reduce(
          (total, venda) => total + Number(venda.valor_vendido || 0), 0,
        ) / diasDaLoja.size
      : 0;
    const vendidoHoje = registrosLoja
      .filter((venda) => venda.data === diaAtual)
      .reduce((total, venda) => total + Number(venda.valor_vendido || 0), 0);

    mediaTotal += mediaLoja;
    projecaoTotal += vendidoLoja + (
      contexto.tipo === "encerrado" ? 0 :
        mediaLoja * diasFuturos +
        (turnoAberto ? Math.max(0, mediaLoja - vendidoHoje) : 0)
    );
  }

  if (contexto.tipo === "encerrado") {
    return {
      valor: totalVendido,
      media: diasBase.size > 0 ? mediaTotal : null,
      diasBase: diasBase.size,
    };
  }

  // Sem nenhum turno encerrado, o parcial não basta para projetar o mês.
  if (!diasBase.size) {
    return { valor: null, media: null, diasBase: 0 };
  }

  return {
    valor: projecaoTotal,
    media: mediaTotal,
    diasBase: diasBase.size,
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
