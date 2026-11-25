import { calcularProjecaoTurno } from "./projecaoTurnos.mjs";
import { preverFechamentoCalendario } from "./previsaoCalendario.mjs";

const DIAS_CORTE = [10, 15, 20, 25];
const PERIODOS = ["manha", "noite"];
const ultimoDia = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const chaveMes = (ano, mes) => String(ano) + "-" + String(mes).padStart(2, "0");
const media = (valores) => valores.reduce((a, b) => a + b, 0) / valores.length;

function validarMesCompleto(registros, lojas, periodos, mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const esperado = ultimoDia(ano, numeroMes);
  const porChave = new Map();
  for (const item of registros) {
    const data = String(item.data || "");
    const dia = Number(data.slice(8));
    const valor = Number(item.valor_vendido);
    const chave = String(item.loja_id) + "|" + item.periodo + "|" + data;
    if (!Number.isInteger(dia) || dia < 1 || dia > esperado ||
        data !== mes + "-" + String(dia).padStart(2, "0") ||
        item.valor_vendido == null || !Number.isFinite(valor) ||
        valor < 0 || porChave.has(chave)) return false;
    porChave.set(chave, valor);
  }
  for (const loja of lojas) {
    for (const periodo of periodos) {
      for (let dia = 1; dia <= esperado; dia += 1) {
        const data = mes + "-" + String(dia).padStart(2, "0");
        if (!porChave.has(String(loja.id) + "|" + periodo + "|" + data)) return false;
      }
    }
  }
  return true;
}

export function compararPrevisoesCalendario({
  vendas = [], lojas = [], anoLimite, filtroLoja = "geral",
  filtroPeriodo = "todos", diasCorte = DIAS_CORTE,
}) {
  const escolhidas = lojas.filter((loja) =>
    filtroLoja === "geral" || String(loja.id) === String(filtroLoja));
  const periodos = filtroPeriodo === "todos" ? PERIODOS : [filtroPeriodo];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(anoLimite)) ||
      !escolhidas.length || periodos.some((item) => !PERIODOS.includes(item))) {
    return { status: "parametros_invalidos", meses: [], metricas: null };
  }

  const ids = new Set(escolhidas.map((item) => String(item.id)));
  const meses = new Map();
  for (const item of vendas) {
    const data = String(item.data || "");
    const mes = data.slice(0, 7);
    if (mes >= anoLimite || mes < "2024-07" ||
        !ids.has(String(item.loja_id)) || !periodos.includes(item.periodo)) continue;
    if (!meses.has(mes)) meses.set(mes, []);
    meses.get(mes).push(item);
  }
  const resultados = [];
  for (const [mes, registros] of [...meses].sort(([a], [b]) => a.localeCompare(b))) {
    if (!validarMesCompleto(registros, escolhidas, periodos, mes)) continue;
    const [ano, numeroMes] = mes.split("-").map(Number);
    const dias = ultimoDia(ano, numeroMes);
    const realizados = registros.reduce((s, item) => s + Number(item.valor_vendido), 0);
    const anteriores = vendas.filter((item) => String(item.data || "").slice(0, 7) < mes);
    const testes = [];
    for (const diaCorte of diasCorte) {
      if (!Number.isInteger(diaCorte) || diaCorte >= dias || diaCorte < 7) continue;
      const parcial = registros.filter((item) => Number(String(item.data).slice(8)) <= diaCorte);
      let atual = 0;
      let calendario = 0;
      let elegivel = true;
      for (const loja of escolhidas) {
        for (const periodo of periodos) {
          const resultado = preverFechamentoCalendario({
            vendas: parcial, historicos: anteriores, ano, numeroMes,
            diaCorte, lojaId: loja.id, periodo,
          });
          if (resultado.status !== "ok") { elegivel = false; break; }
          const referencia = calcularProjecaoTurno({
            vendas: parcial, historicos: anteriores, lojas: [loja], periodo,
            contexto: { tipo: "andamento", ano, numeroMes, diaCorte, ultimoDia: dias },
            minutosAgora: 1440, fimTurno: 0,
          });
          if (!Number.isFinite(referencia.valor)) { elegivel = false; break; }
          atual += referencia.valor;
          calendario += resultado.previsto;
        }
        if (!elegivel) break;
      }
      if (elegivel) {
        testes.push({
          diaCorte, realizado: realizados, atual, calendario,
          erroAtual: atual - realizados, erroCalendario: calendario - realizados,
        });
      }
    }
    if (testes.length) {
      resultados.push({
        mes, realizado: realizados, testes: testes.length,
        maeAtual: media(testes.map((item) => Math.abs(item.erroAtual))),
        maeCalendario: media(testes.map((item) => Math.abs(item.erroCalendario))),
        viesAtual: media(testes.map((item) => item.erroAtual)),
        viesCalendario: media(testes.map((item) => item.erroCalendario)),
        mapeAtual: realizados > 0
          ? media(testes.map((item) => Math.abs(item.erroAtual) / realizados * 100)) : null,
        mapeCalendario: realizados > 0
          ? media(testes.map((item) => Math.abs(item.erroCalendario) / realizados * 100)) : null,
      });
    }
  }
  if (!resultados.length) return {
    status: "amostra_insuficiente", meses: [], metricas: null,
  };
  const amostraMape = resultados.filter((item) => item.mapeAtual !== null);
  return {
    status: "ok", meses: resultados,
    metricas: {
      meses: resultados.length,
      cortes: resultados.reduce((s, item) => s + item.testes, 0),
      maeAtual: media(resultados.map((item) => item.maeAtual)),
      maeCalendario: media(resultados.map((item) => item.maeCalendario)),
      viesAtual: media(resultados.map((item) => item.viesAtual)),
      viesCalendario: media(resultados.map((item) => item.viesCalendario)),
      mapeAtual: amostraMape.length
        ? media(amostraMape.map((item) => item.mapeAtual)) : null,
      mapeCalendario: amostraMape.length
        ? media(amostraMape.map((item) => item.mapeCalendario)) : null,
      mesesMelhores: resultados.filter((item) => item.maeCalendario < item.maeAtual).length,
    },
  };
}
