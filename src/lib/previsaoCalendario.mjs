// Modelo candidato, somente leitura: não substitui a projeção operacional.
const FERIADOS_FIXOS = new Set([
  "01-01", "04-21", "05-01", "09-07", "10-12",
  "11-02", "11-15", "11-20", "12-25",
]);
const MESES_MINIMOS = 4;
const limitar = (valor, min, max) => Math.max(min, Math.min(max, valor));
const chaveMes = (ano, mes) => String(ano) + "-" + String(mes).padStart(2, "0");
const chaveDia = (ano, mes, dia) => chaveMes(ano, mes) + "-" + String(dia).padStart(2, "0");
const ultimoDia = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const diaSemana = (data) => new Date(data + "T12:00:00Z").getUTCDay();
const indiceMes = (chave) => Number(chave.slice(0, 4)) * 12 + Number(chave.slice(5, 7));
const media = (valores) => valores.reduce((s, v) => s + v, 0) / valores.length;

// Domingo de Páscoa (algoritmo gregoriano de Meeus/Jones/Butcher).
function sextaSanta(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k + 7 * 7) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = (h + l - 7 * m + 114) % 31 + 1;
  const data = new Date(Date.UTC(ano, mes - 1, dia - 2));
  return data.toISOString().slice(0, 10);
}

export function ehFeriadoNacional(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return false;
  const ano = Number(data.slice(0, 4));
  return FERIADOS_FIXOS.has(data.slice(5)) || data === sextaSanta(ano);
}

function consolidarHistorico(historicos, alvo, lojaId, periodo) {
  const registros = new Map();
  for (const item of historicos) {
    if (String(item.loja_id) !== String(lojaId) || item.periodo !== periodo) continue;
    const data = String(item.data || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    const mes = data.slice(0, 7);
    const diferenca = indiceMes(alvo) - indiceMes(mes);
    if (diferenca < 1 || diferenca > 24) continue; // Nunca usa mês alvo/futuro.
    if (!registros.has(mes)) registros.set(mes, []);
    registros.get(mes).push(item);
  }
  const amostras = [];
  let meses = 0;
  for (const [mes, linhas] of registros) {
    const [ano, numeroMes] = mes.split("-").map(Number);
    if (numeroMes < 1 || numeroMes > 12) continue;
    const esperado = ultimoDia(ano, numeroMes);
    const porDia = new Map();
    let valido = linhas.length === esperado;
    for (const item of linhas) {
      const dia = Number(String(item.data).slice(8));
      const valor = Number(item.valor_vendido);
      if (dia < 1 || dia > esperado ||
          String(item.data) !== chaveDia(ano, numeroMes, dia) ||
          item.valor_vendido == null || !Number.isFinite(valor) ||
          valor < 0 || porDia.has(dia)) {
        valido = false;
        break;
      }
      porDia.set(dia, valor);
    }
    if (!valido || porDia.size !== esperado) continue;
    const total = [...porDia.values()].reduce((s, valor) => s + valor, 0);
    if (total <= 0) continue; // Mês todo zerado não permite estimar perfil.
    meses += 1;
    for (const [dia, valor] of porDia) {
      const data = chaveDia(ano, numeroMes, dia);
      amostras.push({
        semana: diaSemana(data),
        feriado: ehFeriadoNacional(data),
        relativo: valor / (total / esperado),
      });
    }
  }
  return { amostras, meses };
}

// Modelo aditivo de calendário em índices normalizados por mês e por loja/turno.
// As médias são regularizadas e limitadas para evitar superajuste.
function aprenderPesos(amostras) {
  const diasComuns = amostras.filter((item) => !item.feriado);
  const semana = Array.from({ length: 7 }, (_, indice) => {
    const casos = diasComuns.filter((item) => item.semana === indice);
    if (casos.length < 6) return 1;
    const peso = casos.length / (casos.length + 12);
    return limitar(1 + (media(casos.map((item) => item.relativo)) - 1) * peso,
      0.75, 1.25);
  });
  const feriados = amostras.filter((item) => item.feriado);
  const bruto = feriados.length >= 6
    ? media(feriados.map((item) => item.relativo / semana[item.semana]))
    : 1;
  const fatorFeriado = limitar(1 + (bruto - 1) *
    (feriados.length / (feriados.length + 12)), 0.85, 1.15);
  return {
    semana,
    fatorFeriado,
    feriadosObservados: feriados.length,
  };
}

// Perfil compartilhado com o planejamento dos proximos dias.
export function obterPerfilCalendario({
  historicos = [], ano, numeroMes, lojaId, periodo,
  minimoMeses = MESES_MINIMOS,
}) {
  if (!Number.isInteger(ano) || !Number.isInteger(numeroMes) ||
      numeroMes < 1 || numeroMes > 12 || lojaId == null ||
      !["manha", "noite"].includes(periodo)) {
    return { status: "parametros_invalidos" };
  }
  const { amostras, meses } = consolidarHistorico(
    historicos, chaveMes(ano, numeroMes), lojaId, periodo,
  );
  if (meses < minimoMeses) {
    return { status: "historico_insuficiente", mesesHistoricos: meses };
  }
  return { status: "ok", mesesHistoricos: meses, ...aprenderPesos(amostras) };
}

export function pesoDoDiaCalendario(perfil, data) {
  if (perfil?.status !== "ok" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return null;
  const peso = perfil.semana[diaSemana(data)] *
    (ehFeriadoNacional(data) ? perfil.fatorFeriado : 1);
  return Number.isFinite(peso) && peso > 0 ? peso : null;
}

export function preverFechamentoCalendario({
  vendas = [], historicos = [], ano, numeroMes, diaCorte,
  lojaId, periodo, minimoMeses = MESES_MINIMOS,
}) {
  const indisponivel = (status, detalhes = {}) => ({
    status, previsto: null, ...detalhes,
  });
  if (!Number.isInteger(ano) || !Number.isInteger(numeroMes) ||
      numeroMes < 1 || numeroMes > 12 || !Number.isInteger(diaCorte) ||
      !["manha", "noite"].includes(periodo) || lojaId == null) {
    return indisponivel("parametros_invalidos");
  }
  const dias = ultimoDia(ano, numeroMes);
  if (diaCorte < 7 || diaCorte >= dias) return indisponivel("corte_indisponivel");
  const mes = chaveMes(ano, numeroMes);
  const valores = new Map();
  let invalido = false;
  for (const item of vendas) {
    if (item.periodo !== periodo || String(item.loja_id) !== String(lojaId) ||
        !String(item.data || "").startsWith(mes + "-")) continue;
    const dia = Number(String(item.data).slice(8));
    if (dia > diaCorte) continue; // Não usa vendas futuras da mesma competência.
    const valor = Number(item.valor_vendido);
    if (!Number.isInteger(dia) || dia < 1 ||
        String(item.data) !== chaveDia(ano, numeroMes, dia) ||
        item.valor_vendido == null || !Number.isFinite(valor) ||
        valor < 0 || valores.has(dia)) {
      invalido = true;
      break;
    }
    valores.set(dia, valor);
  }
  if (invalido || valores.size !== diaCorte) {
    return indisponivel("lancamentos_incompletos", { diasBase: valores.size });
  }
  const { amostras, meses } = consolidarHistorico(historicos, mes, lojaId, periodo);
  if (meses < minimoMeses) {
    return indisponivel("historico_insuficiente", { mesesHistoricos: meses });
  }
  const { semana, fatorFeriado, feriadosObservados } = aprenderPesos(amostras);
  let pesosPassados = 0;
  let pesosFuturos = 0;
  for (let dia = 1; dia <= dias; dia += 1) {
    const data = chaveDia(ano, numeroMes, dia);
    const peso = semana[diaSemana(data)] * (ehFeriadoNacional(data) ? fatorFeriado : 1);
    if (dia <= diaCorte) pesosPassados += peso;
    else pesosFuturos += peso;
  }
  const vendido = [...valores.values()].reduce((s, valor) => s + valor, 0);
  const previsto = vendido + (vendido / pesosPassados) * pesosFuturos;
  return {
    status: "ok", previsto, vendido, diaCorte,
    mesesHistoricos: meses, feriadosObservados,
    fatorFeriado, pesosSemana: semana,
  };
}
