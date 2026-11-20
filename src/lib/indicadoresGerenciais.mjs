import {
  desvioPadrao,
  diaDaData,
  media,
  regressaoLinear,
  somar,
  textoTendencia,
} from "./analiseGerencial.js";
import { calcularProjecaoTurno, somarProjecoes } from "./projecaoTurnos.mjs";
import { extremosDiasSemana } from "./extremosDiasSemana.mjs";

const PERIODOS = ["manha", "noite"];
const NOMES_SEMANA = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

// Mesma base de turnos e mesma previsão central usados no Acompanhar Turno.
// A dispersão usa somente dias com todos os slots encerrados e lançados.
export function analisarIndicadoresGerenciais({
  vendas = [],
  historicos = [],
  metas = [],
  lojas = [],
  contexto,
  minutosAgora = 0,
  fimManha = 960,
  fimNoite = 1320,
  filtroLoja = "geral",
  filtroPeriodo = "todos",
}) {
  const lojasSelecionadas = lojas.filter(
    (loja) => filtroLoja === "geral" || String(loja.id) === String(filtroLoja),
  );
  const ids = new Set(lojasSelecionadas.map((loja) => String(loja.id)));
  const periodos = filtroPeriodo === "todos" ? PERIODOS : [filtroPeriodo];
  const prefixo = String(contexto.ano) + "-" +
    String(contexto.numeroMes).padStart(2, "0") + "-";
  const dataAtual = prefixo + String(contexto.diaCorte).padStart(2, "0");
  const emAndamento = contexto.tipo !== "futuro" && contexto.tipo !== "encerrado";
  const turnoAberto = (periodo) => emAndamento &&
    minutosAgora < (periodo === "manha" ? fimManha : fimNoite);

  const vendasSelecionadas = vendas.filter(
    (venda) => ids.has(String(venda.loja_id)) &&
      periodos.includes(venda.periodo) &&
      String(venda.data || "").startsWith(prefixo) &&
      diaDaData(venda.data) <= contexto.diaCorte,
  );
  const metasSelecionadas = metas.filter(
    (meta) => ids.has(String(meta.loja_id)) && periodos.includes(meta.periodo),
  );
  const totalVendido = somar(vendasSelecionadas);
  const totalMeta = somar(metasSelecionadas, "valor_meta");
  const mapaDias = new Map();
  vendasSelecionadas.forEach((venda) => {
    if (!mapaDias.has(venda.data)) {
      mapaDias.set(venda.data, { total: 0, slots: new Set() });
    }
    const dia = mapaDias.get(venda.data);
    dia.total += Number(venda.valor_vendido || 0);
    dia.slots.add(String(venda.loja_id) + "|" + venda.periodo);
  });

  const diasObservados = [...mapaDias.entries()].sort(([a], [b]) => a.localeCompare(b));
  const slotsEsperados = lojasSelecionadas.length * periodos.length;
  const diasCompletos = diasObservados.filter(([data, dia]) =>
    slotsEsperados > 0 &&
    dia.slots.size >= slotsEsperados &&
    (data !== dataAtual || !periodos.some(turnoAberto)),
  );
  const valoresCompletos = diasCompletos.map(([, dia]) => dia.total);
  const desvioDiario = desvioPadrao(valoresCompletos);
  const ultimosValores = valoresCompletos.slice(-10);
  const tendencia = regressaoLinear(ultimosValores);
  const nomeTendencia = ultimosValores.length < 2
    ? "base em formação"
    : textoTendencia(tendencia.inclinacao, media(ultimosValores));

  const previsoes = periodos.map((periodo) => calcularProjecaoTurno({
    vendas: vendasSelecionadas,
    historicos,
    lojas: lojasSelecionadas,
    periodo,
    contexto,
    minutosAgora,
    fimTurno: periodo === "manha" ? fimManha : fimNoite,
  }));
  const projecaoOperacional = contexto.tipo === "futuro"
    ? null
    : somarProjecoes(...previsoes.map((item) => item.valor));
  const pendentes = previsoes.reduce((soma, item) => soma + (item.pendentes || 0), 0);
  const sazonal = previsoes.some((item) => item.sazonal);

  const extremos = extremosDiasSemana(diasCompletos, NOMES_SEMANA);
  return {
    totalVendido,
    totalMeta,
    temMeta: totalMeta > 0,
    temVendas: vendasSelecionadas.length > 0,
    diasObservados,
    diasCompletos,
    baseEstatistica: valoresCompletos,
    desvioDiario,
    projecaoOperacional,
    pendentes,
    sazonal,
    tendencia,
    nomeTendencia,
    ultimosValores,
    ...extremos,
  };
}
