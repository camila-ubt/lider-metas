import { calcularMetasDiariasLoja } from "./metasImpressao.mjs";

export function calcularAcompanhamentoTurno({
  lojas = [],
  metas = [],
  mes,
  periodo = "noite",
  nivel = 100,
  vendasEmCentavos = {},
}) {
  const [ano, numeroMes] = String(mes || "").split("-").map(Number);
  const diasMes = ano > 0 && numeroMes >= 1 && numeroMes <= 12
    ? new Date(ano, numeroMes, 0).getDate()
    : 0;
  const faixa = nivel === 110 ? "super" : nivel === 120 ? "mega" : "meta";
  const sigla = periodo === "manha" ? "M" : "N";

  const porLoja = lojas.map((loja) => {
    const configurada = metas.some(
      (registro) => String(registro.loja_id) === String(loja.id) && registro.periodo === periodo,
    );
    const linha = configurada && diasMes
      ? calcularMetasDiariasLoja({ metas, lojaId: loja.id, totalDias: diasMes })
          .find((item) => item.sigla === sigla)
      : null;
    const metaCentavos = linha ? Math.round(linha[faixa] * 100) : null;
    const digitado = Number(vendasEmCentavos[String(loja.id)] || 0);
    const vendidoCentavos = Number.isFinite(digitado) && digitado > 0
      ? Math.round(digitado)
      : 0;

    return {
      loja,
      meta: metaCentavos === null ? null : metaCentavos / 100,
      vendido: vendidoCentavos / 100,
      falta: metaCentavos === null ? null : Math.max(0, metaCentavos - vendidoCentavos) / 100,
      excedente: metaCentavos === null ? null : Math.max(0, vendidoCentavos - metaCentavos) / 100,
      metaCentavos,
      vendidoCentavos,
    };
  });

  const metasCompletas = porLoja.length > 0 &&
    porLoja.every((item) => item.metaCentavos !== null);
  const metaTotalCentavos = porLoja.reduce((total, item) => total + (item.metaCentavos || 0), 0);
  const vendidoTotalCentavos = porLoja.reduce((total, item) => total + item.vendidoCentavos, 0);
  const faltaGeralCentavos = metasCompletas
    ? Math.max(0, metaTotalCentavos - vendidoTotalCentavos)
    : null;

  return {
    porLoja,
    metasCompletas,
    metaTotal: metasCompletas ? metaTotalCentavos / 100 : null,
    vendidoTotal: vendidoTotalCentavos / 100,
    faltaGeral: faltaGeralCentavos === null ? null : faltaGeralCentavos / 100,
    mediaPorLoja: faltaGeralCentavos === null ? null : faltaGeralCentavos / 100 / porLoja.length,
    percentual: metasCompletas && metaTotalCentavos > 0
      ? (vendidoTotalCentavos / metaTotalCentavos) * 100
      : null,
  };
}
