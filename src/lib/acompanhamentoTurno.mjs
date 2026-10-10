import { calcularMetasDiariasLoja } from "./metasImpressao.mjs";

function centavos(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero * 100) : 0;
}

function valorAjustado(metaMensalCentavos, vendidoAntesCentavos, diasRestantes) {
  if (diasRestantes <= 0) return null;
  return Math.ceil(Math.max(0, metaMensalCentavos - vendidoAntesCentavos) / diasRestantes);
}

export function calcularAcompanhamentoTurno({
  lojas = [],
  metas = [],
  vendas = [],
  mes,
  data,
  periodo = "noite",
  nivel = 100,
  vendasEmCentavos = {},
}) {
  const [ano, numeroMes] = String(mes || "").split("-").map(Number);
  const diasMes = ano > 0 && numeroMes >= 1 && numeroMes <= 12
    ? new Date(ano, numeroMes, 0).getDate()
    : 0;
  const dia = Number(String(data || "").slice(8, 10));
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(String(data || "")) &&
    data.slice(0, 7) === mes && dia >= 1 && dia <= diasMes;
  const diasRestantes = dataValida ? diasMes - dia + 1 : 0;
  const fator = nivel === 110 ? 1.1 : nivel === 120 ? 1.2 : 1;
  const faixa = nivel === 110 ? "super" : nivel === 120 ? "mega" : "meta";
  const sigla = periodo === "manha" ? "M" : "N";

  // Vendas do próprio dia não entram no histórico para não somar duas vezes
  // o valor digitado manualmente durante o acompanhamento.
  const historico = (vendas || []).filter(
    (venda) => venda.periodo === periodo &&
      typeof venda.data === "string" &&
      venda.data.slice(0, 7) === mes &&
      venda.data < data,
  );

  const porLoja = (lojas || []).map((loja) => {
    const registros = metas.filter(
      (registro) => String(registro.loja_id) === String(loja.id) && registro.periodo === periodo,
    );
    const metaMensalBase = registros.reduce(
      (total, registro) => total + centavos(registro.valor_meta), 0,
    );
    const metaMensalCentavos = Math.round(metaMensalBase * fator);
    const vendidoAntesCentavos = historico
      .filter((venda) => String(venda.loja_id) === String(loja.id))
      .reduce((total, venda) => total + centavos(venda.valor_vendido), 0);
    const linha = registros.length && diasRestantes
      ? calcularMetasDiariasLoja({ metas, lojaId: loja.id, totalDias: diasMes })
          .find((item) => item.sigla === sigla)
      : null;
    const metaCentavos = registros.length
      ? valorAjustado(metaMensalCentavos, vendidoAntesCentavos, diasRestantes)
      : null;
    const digitado = Number(vendasEmCentavos[String(loja.id)] || 0);
    const vendidoCentavos = Number.isFinite(digitado) && digitado > 0
      ? Math.round(digitado)
      : 0;

    return {
      loja,
      meta: metaCentavos === null ? null : metaCentavos / 100,
      metaFixa: linha ? linha[faixa] : null,
      vendido: vendidoCentavos / 100,
      vendidoAntes: vendidoAntesCentavos / 100,
      falta: metaCentavos === null ? null : Math.max(0, metaCentavos - vendidoCentavos) / 100,
      excedente: metaCentavos === null ? null : Math.max(0, vendidoCentavos - metaCentavos) / 100,
      metaCentavos,
      metaMensalCentavos,
      vendidoAntesCentavos,
      vendidoCentavos,
    };
  });

  const metasCompletas = porLoja.length > 0 &&
    porLoja.every((item) => item.metaCentavos !== null);
  const vendidoTotalCentavos = porLoja.reduce((total, item) => total + item.vendidoCentavos, 0);
  const metaMensalGeralCentavos = porLoja.reduce(
    (total, item) => total + item.metaMensalCentavos, 0,
  );
  const vendidoAntesGeralCentavos = porLoja.reduce(
    (total, item) => total + item.vendidoAntesCentavos, 0,
  );
  // Calcula o geral pelo saldo mensal coletivo, não pela soma das metas
  // individuais já zeradas, permitindo compensação entre lojas no histórico.
  const metaTotalCentavos = metasCompletas
    ? valorAjustado(metaMensalGeralCentavos, vendidoAntesGeralCentavos, diasRestantes)
    : null;
  const faltaGeralCentavos = metaTotalCentavos === null
    ? null
    : Math.max(0, metaTotalCentavos - vendidoTotalCentavos);
  const metaFixaTotal = metasCompletas
    ? porLoja.reduce((total, item) => total + item.metaFixa, 0)
    : null;

  return {
    porLoja,
    diasRestantes,
    metasCompletas,
    metaTotal: metaTotalCentavos === null ? null : metaTotalCentavos / 100,
    metaFixaTotal,
    vendidoAntesGeral: vendidoAntesGeralCentavos / 100,
    vendidoTotal: vendidoTotalCentavos / 100,
    faltaGeral: faltaGeralCentavos === null ? null : faltaGeralCentavos / 100,
    mediaPorLoja: faltaGeralCentavos === null ? null : faltaGeralCentavos / 100 / porLoja.length,
    percentual: metaTotalCentavos === null
      ? null
      : metaTotalCentavos === 0 ? 100 : (vendidoTotalCentavos / metaTotalCentavos) * 100,
  };
}
