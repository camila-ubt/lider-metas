import { obterPerfilCalendario, pesoDoDiaCalendario } from "./previsaoCalendario.mjs";

const TURNOS = ["manha", "noite"];
const DIAS_BASE = 14;
const MINIMO_DIAS = 7;
const expressaoData = /^\d{4}-\d{2}-\d{2}$/;

function adicionarDias(data, quantidade) {
  const dia = new Date(data + "T12:00:00Z");
  dia.setUTCDate(dia.getUTCDate() + quantidade);
  return dia.toISOString().slice(0, 10);
}
function ultimoDia(data) {
  return new Date(Date.UTC(Number(data.slice(0, 4)),
    Number(data.slice(5, 7)), 0)).getUTCDate();
}
function mesDaData(data) {
  return data.slice(0, 7);
}
function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
function metaFixaDiaria(metas, lojaId, periodo, data) {
  const registros = metas.filter((meta) =>
    String(meta.loja_id) === String(lojaId) &&
    meta.periodo === periodo &&
    String(meta.mes || "").slice(0, 7) === mesDaData(data));
  if (registros.length !== 1 || registros[0].valor_meta == null) return null;
  const valor = Number(registros[0].valor_meta);
  return Number.isFinite(valor) && valor > 0
    ? Math.floor(valor / ultimoDia(data)) : null;
}

function baseRecente({ vendas, hoje, lojaId, periodo, perfil }) {
  const datas = Array.from({ length: DIAS_BASE }, (_, indice) =>
    adicionarDias(hoje, -indice - 1));
  const inicio = datas[DIAS_BASE - 1];
  const vistos = new Map();
  for (const registro of vendas) {
    const data = String(registro.data || "");
    if (String(registro.loja_id) !== String(lojaId) ||
        registro.periodo !== periodo || data < inicio || data >= hoje) continue;
    if (!vistos.has(data)) vistos.set(data, []);
    vistos.get(data).push(registro);
  }
  let soma = 0;
  let pesoTotal = 0;
  let diasCompletos = 0;
  for (const data of datas) {
    const registros = vistos.get(data) || [];
    if (registros.length !== 1) break;
    const venda = registros[0];
    const valor = Number(venda.valor_vendido);
    const peso = pesoDoDiaCalendario(perfil, data);
    if (venda.valor_vendido == null || !Number.isFinite(valor) ||
        valor < 0 || !(peso > 0)) break;
    soma += valor;
    pesoTotal += peso;
    diasCompletos++;
  }
  if (diasCompletos < MINIMO_DIAS || !(pesoTotal > 0)) {
    return { status: "lancamentos_insuficientes", diasCompletos };
  }
  return { status: "ok", ritmoPorPeso: soma / pesoTotal, diasCompletos };
}

// Previsão auxiliar, somente leitura: usa os últimos dias COMPLETOS,
// perfil histórico por loja/turno e metas fixas do mês da data futura.
export function planejarProximosSeteDias({
  hoje, lojas = [], vendasAtuais = [], historicos = [],
  metasAtuais = [], metasProximoMes = [], quantidadeDias = 7,
}) {
  const referencia = String(hoje || "");
  const valida = expressaoData.test(referencia) &&
    !Number.isNaN(new Date(referencia + "T12:00:00Z").getTime()) &&
    new Date(referencia + "T12:00:00Z").toISOString().slice(0, 10) === referencia;
  if (!valida || !Number.isInteger(quantidadeDias) ||
      quantidadeDias < 1 || quantidadeDias > 7) {
    return { status: "parametros_invalidos", dias: [], alertas: [] };
  }
  const ano = Number(referencia.slice(0, 4));
  const numeroMes = Number(referencia.slice(5, 7));
  const vendas = [...historicos, ...vendasAtuais];
  const metas = [...metasAtuais, ...metasProximoMes];
  const perfis = new Map();
  for (const loja of lojas) {
    for (const periodo of TURNOS) {
      const chave = String(loja.id) + "|" + periodo;
      const perfil = obterPerfilCalendario({
        historicos, ano, numeroMes, lojaId: loja.id, periodo,
      });
      const base = perfil.status === "ok"
        ? baseRecente({ vendas, hoje: referencia, lojaId: loja.id, periodo, perfil })
        : { status: perfil.status, diasCompletos: 0 };
      perfis.set(chave, { perfil, base });
    }
  }
  const dias = [];
  const alertas = [];
  let semPrevisao = 0;
  let semMeta = 0;
  for (let i = 1; i <= quantidadeDias; i++) {
    const data = adicionarDias(referencia, i);
    const linhas = [];
    for (const loja of lojas) {
      for (const periodo of TURNOS) {
        const chave = String(loja.id) + "|" + periodo;
        const { perfil, base } = perfis.get(chave);
        const peso = pesoDoDiaCalendario(perfil, data);
        const previsto = base.status === "ok" && peso != null
          ? arredondar(base.ritmoPorPeso * peso) : null;
        const meta = metaFixaDiaria(metas, loja.id, periodo, data);
        const falta = previsto !== null && meta !== null
          ? arredondar(Math.max(meta - previsto, 0)) : null;
        const situacao = previsto === null ? "sem_previsao"
          : meta === null ? "sem_meta"
            : falta > 0 ? "atencao" : "sem_alerta";
        if (situacao === "sem_previsao") semPrevisao++;
        if (situacao === "sem_meta") semMeta++;
        const linha = {
          data, lojaId: loja.id, loja: loja.codigo || loja.nome || String(loja.id),
          periodo, previsto, meta, falta, situacao,
          motivoSemPrevisao: previsto === null ? base.status : null,
          percentualAbaixo: falta !== null && meta > 0
            ? (falta / meta) * 100 : null,
          diasBase: base.diasCompletos || 0,
        };
        linhas.push(linha);
        if (situacao === "atencao") alertas.push(linha);
      }
    }
    dias.push({ data, linhas });
  }
  alertas.sort((a, b) => b.percentualAbaixo - a.percentualAbaixo ||
    a.data.localeCompare(b.data) || b.falta - a.falta);
  return { status: "ok", dias, alertas, semPrevisao, semMeta,
    totalTurnos: dias.reduce((soma, dia) => soma + dia.linhas.length, 0) };
}
