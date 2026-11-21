const PERIODOS = ["manha", "noite"];
const NIVEIS = [
  { id: "meta", fator: 1 },
  { id: "super", fator: 1.1 },
  { id: "mega", fator: 1.2 },
];

const ultimoDia = (ano, mes) => new Date(ano, mes, 0).getDate();
const chaveMes = (ano, mes) => `${ano}-${String(mes).padStart(2, "0")}`;
const chaveSlot = (lojaId, periodo) => `${lojaId}|${periodo}`;
const somar = (numeros) => numeros.reduce((total, valor) => total + valor, 0);
const limitar = (valor, min, max) => Math.max(min, Math.min(max, valor));

function compararMeses(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function indicadores(dias, corte, meta) {
  const acumulado = somar(dias.slice(0, corte));
  const mediaGeral = acumulado / corte;
  const mediaRecente = somar(dias.slice(Math.max(0, corte - 7), corte)) /
    Math.min(corte, 7);
  return {
    progresso: acumulado / meta,
    ritmo: corte >= 8 && mediaGeral > 0
      ? limitar(mediaRecente / mediaGeral, 0, 4) : 1,
    acumulado,
  };
}

// Reconstrói somente meses completos, com um valor por loja, turno e dia.
// Ausência de lançamento não representa venda zero, mas zero explícito vale.
export function reconstruirMeses({ vendas, metas, slots, anoLimite }) {
  const esperados = new Set(slots);
  const metasMap = new Map();
  for (const item of metas) {
    const mes = String(item.mes || "").slice(0, 7);
    const chave = chaveSlot(item.loja_id, item.periodo);
    if (!esperados.has(chave) || !/^\d{4}-\d{2}$/.test(mes) ||
        compararMeses(mes, anoLimite) >= 0) continue;
    if (!metasMap.has(mes)) metasMap.set(mes, new Map());
    const valores = metasMap.get(mes);
    if (valores.has(chave)) {
      valores.set(chave, null);
      continue;
    }
    const meta = Number(item.valor_meta);
    valores.set(chave, Number.isFinite(meta) && meta > 0 ? meta : null);
  }

  const vendasMap = new Map();
  for (const item of vendas) {
    const data = String(item.data || "");
    const mes = data.slice(0, 7);
    const chave = chaveSlot(item.loja_id, item.periodo);
    if (!esperados.has(chave) || !metasMap.has(mes)) continue;
    const dia = Number(data.slice(8, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isInteger(dia) ||
        dia < 1 || dia > ultimoDia(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)))) {
      continue;
    }
    if (!vendasMap.has(mes)) vendasMap.set(mes, new Map());
    const dias = vendasMap.get(mes);
    const id = `${chave}|${dia}`;
    const valor = Number(item.valor_vendido);
    if (dias.has(id) || item.valor_vendido == null ||
        !Number.isFinite(valor) || valor < 0) {
      dias.set(id, null);
    } else {
      dias.set(id, valor);
    }
  }

  const resultados = [];
  for (const [mes, metasDoMes] of metasMap) {
    if (metasDoMes.size !== slots.length ||
        [...metasDoMes.values()].some((valor) => valor === null)) continue;
    const totalMeta = somar([...metasDoMes.values()]);
    const [ano, numeroMes] = mes.split("-").map(Number);
    const quantidadeDias = ultimoDia(ano, numeroMes);
    const registrados = vendasMap.get(mes);
    if (!registrados) continue;
    const dias = [];
    let completo = true;
    for (let dia = 1; dia <= quantidadeDias; dia += 1) {
      let total = 0;
      for (const slot of slots) {
        const valor = registrados.get(`${slot}|${dia}`);
        if (valor === undefined || valor === null) {
          completo = false;
          break;
        }
        total += valor;
      }
      if (!completo) break;
      dias.push(total);
    }
    if (!completo) continue;
    resultados.push({ ano, mes: numeroMes, chave: mes,
      meta: totalMeta, dias, realizado: somar(dias) });
  }
  return resultados.sort((a, b) => a.chave.localeCompare(b.chave));
}

function consolidarAtual({ vendas, metas, slots, ano, numeroMes, diaLimite }) {
  const mes = chaveMes(ano, numeroMes);
  const slotSet = new Set(slots);
  const mapaMetas = new Map();
  for (const item of metas) {
    const chave = chaveSlot(item.loja_id, item.periodo);
    if (!slotSet.has(chave)) continue;
    if (mapaMetas.has(chave)) return null;
    const valor = Number(item.valor_meta);
    if (!(valor > 0) || !Number.isFinite(valor)) return null;
    mapaMetas.set(chave, valor);
  }
  if (mapaMetas.size !== slots.length) return null;
  const meta = somar([...mapaMetas.values()]);
  const valores = new Map();
  for (const item of vendas) {
    const data = String(item.data || "");
    const chave = chaveSlot(item.loja_id, item.periodo);
    if (!data.startsWith(mes + "-") || !slotSet.has(chave)) continue;
    const dia = Number(data.slice(8, 10));
    if (!Number.isInteger(dia) || dia < 1 || dia > ultimoDia(ano, numeroMes)) continue;
    const id = `${chave}|${dia}`;
    const valor = Number(item.valor_vendido);
    if (valores.has(id) || item.valor_vendido == null ||
        !Number.isFinite(valor) || valor < 0) {
      valores.set(id, null);
    } else {
      valores.set(id, valor);
    }
  }

  const maximo = limitar(Math.trunc(diaLimite), 0, ultimoDia(ano, numeroMes));
  const dias = [];
  for (let dia = 1; dia <= maximo; dia += 1) {
    let total = 0;
    let completo = true;
    for (const slot of slots) {
      const valor = valores.get(`${slot}|${dia}`);
      if (valor === undefined || valor === null) {
        completo = false;
        break;
      }
      total += valor;
    }
    if (!completo) break;
    dias.push(total);
  }
  return { meta, dias, corte: dias.length };
}

// Referências do mesmo mês têm peso adicional, mas outros meses concluídos
// oferecem a dispersão necessária para estimar probabilidades, não só projeções.
export function estimarChancesHistoricas({
  vendas = [], metas = [], vendasHistoricas = [], metasHistoricas = [],
  lojas = [], ano, numeroMes, diaLimite,
  filtroLoja = "geral", filtroPeriodo = "todos",
  minimoMeses = 6,
}) {
  if (!Number.isInteger(ano) || !Number.isInteger(numeroMes) ||
      numeroMes < 1 || numeroMes > 12 ||
      !Number.isFinite(diaLimite) || filtroPeriodo !== "todos" &&
      !PERIODOS.includes(filtroPeriodo)) {
    return { status: "parametros_invalidos", probabilidades: null };
  }
  const lojasSelecionadas = lojas.filter((loja) => filtroLoja === "geral" ||
    String(loja.id) === String(filtroLoja));
  const periodos = filtroPeriodo === "todos" ? PERIODOS : [filtroPeriodo];
  const slots = lojasSelecionadas.flatMap((loja) =>
    periodos.map((periodo) => chaveSlot(loja.id, periodo)));
  if (!slots.length) return { status: "sem_lojas", probabilidades: null };

  const atual = consolidarAtual({
    vendas, metas, slots, ano, numeroMes, diaLimite,
  });
  if (!atual) return { status: "sem_metas", probabilidades: null };
  if (atual.corte < 3) return {
    status: "sem_base", probabilidades: null, diaBase: atual.corte,
  };

  const candidatas = reconstruirMeses({
    vendas: vendasHistoricas,
    metas: metasHistoricas,
    slots, anoLimite: chaveMes(ano, numeroMes),
  }).filter((item) => item.ano >= ano - 2 && item.ano <= ano - 1);

  if (candidatas.length < minimoMeses) {
    return { status: "historico_insuficiente", probabilidades: null,
      meses: candidatas.length, diaBase: atual.corte };
  }

  const atuais = indicadores(atual.dias, atual.corte, atual.meta);
  const amostras = candidatas.map((historico) => {
    const corte = limitar(Math.round(
      (atual.corte / ultimoDia(ano, numeroMes)) * historico.dias.length,
    ), 1, historico.dias.length);
    const ref = indicadores(historico.dias, corte, historico.meta);
    const deltaProgresso = (ref.progresso - atuais.progresso) / 0.25;
    const deltaRitmo = (ref.ritmo - atuais.ritmo) / 0.6;
    const similaridade = Math.exp(-0.5 *
      (deltaProgresso ** 2 + deltaRitmo ** 2));
    const peso = (0.2 + 0.8 * similaridade) *
      (historico.mes === numeroMes ? 2.5 : 1);
    return { historico, peso };
  });
  const somaPesos = somar(amostras.map(({ peso }) => peso));
  const somaQuadrados = somar(amostras.map(({ peso }) => peso ** 2));
  const tamanhoEfetivo = somaQuadrados > 0
    ? somaPesos ** 2 / somaQuadrados : 0;
  if (tamanhoEfetivo < 4) {
    return { status: "historico_insuficiente", probabilidades: null,
      meses: candidatas.length, diaBase: atual.corte };
  }

  const probabilidades = Object.fromEntries(NIVEIS.map(({ id, fator }) => {
    if (atuais.acumulado >= atual.meta * fator) return [id, 100];
    if (atual.corte === ultimoDia(ano, numeroMes)) return [id, 0];
    const positivos = somar(amostras.map(({ historico, peso }) =>
      peso * Number(historico.realizado >= historico.meta * fator)));
    // Suavização Beta(1,1) para evitar 0% e 100% com amostras pequenas.
    const estimativa = (positivos + 1) / (somaPesos + 2);
    return [id, limitar(Math.round(estimativa * 20) * 5, 5, 95)];
  }));

  const anosMesmoMes = [...new Set(candidatas
    .filter((item) => item.mes === numeroMes).map((item) => item.ano))].sort();
  const mesesMesmoMes = candidatas.filter((item) => item.mes === numeroMes).length;

  return {
    status: "ok", probabilidades, diaBase: atual.corte,
    meses: candidatas.length, mesesEfetivos: tamanhoEfetivo,
    mesesMesmoMes,
    mesesApoio: candidatas.length - mesesMesmoMes,
    anosMesmoMes,
  };
}
