const PERIODOS = ["manha", "noite"];

/**
 * Compara o desempenho agregado das lojas em cada período.
 * Mês em andamento: somente dias com todas as lojas lançadas e turno encerrado.
 * Mês encerrado: resultado realizado frente à meta mensal completa.
 */
export function desempenhoPeriodosReuniao({
  lojas = [],
  metas = [],
  vendas = [],
  contexto,
  minutosAgora = 0,
  fimManha = 960,
  fimNoite = 1320,
}) {
  const diasMes = Number(contexto?.ultimoDia) || 0;
  const tipo = contexto?.tipo;
  const ids = new Set(lojas.map((loja) => String(loja.id)));
  const inicioMes = `${contexto?.ano}-${String(contexto?.numeroMes).padStart(2, "0")}-`;

  return PERIODOS.map((periodo) => {
    if (!diasMes || !ids.size || tipo === "futuro" || tipo === "invalido") {
      return { periodo, percentual: null, referencia: "indisponivel" };
    }

    const metaCentavos = metas
      .filter((item) => item.periodo === periodo && ids.has(String(item.loja_id)))
      .reduce((total, item) => {
        const valor = Number(item.valor_meta);
        return total + (Number.isFinite(valor) ? Math.round(valor * 100) : 0);
      }, 0);

    if (metaCentavos <= 0) {
      return { periodo, percentual: null, referencia: "sem-meta" };
    }

    const encerrado = tipo === "encerrado";
    const fim = periodo === "manha" ? fimManha : fimNoite;
    const limite = encerrado
      ? diasMes
      : Math.max(0, Number(contexto.diaCorte || 0) - (minutosAgora < fim ? 1 : 0));

    const porDia = new Map();
    for (const venda of vendas) {
      const data = String(venda.data || "");
      const dia = Number(data.slice(8, 10));
      if (!data.startsWith(inicioMes) || data.length !== 10 ||
          !Number.isInteger(dia) || dia < 1 || dia > limite ||
          venda.periodo !== periodo || !ids.has(String(venda.loja_id)) ||
          venda.valor_vendido == null) continue;

      const valor = Number(venda.valor_vendido);
      if (!Number.isFinite(valor)) continue;
      if (!porDia.has(dia)) porDia.set(dia, new Map());
      const porLoja = porDia.get(dia);
      const chave = String(venda.loja_id);
      porLoja.set(chave, (porLoja.get(chave) || 0) + Math.round(valor * 100));
    }

    if (encerrado) {
      const vendido = [...porDia.values()].reduce(
        (total, porLoja) => total + [...porLoja.values()].reduce((soma, valor) => soma + valor, 0), 0,
      );
      return {
        periodo,
        percentual: metaCentavos ? vendido / metaCentavos * 100 : null,
        referencia: "final",
      };
    }

    const completos = [...porDia.values()].filter(
      (porLoja) => [...ids].every((id) => porLoja.has(id)),
    );
    if (!completos.length) {
      return { periodo, percentual: null, referencia: "sem-lancamentos" };
    }

    const vendido = completos.reduce(
      (total, porLoja) => total + [...porLoja.values()].reduce((soma, valor) => soma + valor, 0), 0,
    );
    const esperado = metaCentavos * completos.length / diasMes;
    return {
      periodo,
      percentual: esperado > 0 ? vendido / esperado * 100 : null,
      referencia: "parcial",
    };
  });
}
