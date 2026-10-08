import { extremosDiasSemana } from "./extremosDiasSemana.mjs";

const NOMES_SEMANA = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const PERIODOS = ["manha", "noite"];
const COBERTURA_MINIMA = 0.8;

function resumoDiario(registros, ano, numeroMes, lojas) {
  const prefixo = `${ano}-${String(numeroMes).padStart(2, "0")}-`;
  const lojasIds = new Set(lojas.map((loja) => String(loja.id)));
  const slotsEsperados = new Set(
    [...lojasIds].flatMap((lojaId) => PERIODOS.map((periodo) => `${lojaId}|${periodo}`)),
  );
  const agrupados = new Map();

  for (const venda of registros) {
    if (!String(venda.data || "").startsWith(prefixo)) continue;
    const lojaId = String(venda.loja_id);
    const slot = `${lojaId}|${venda.periodo}`;
    if (!slotsEsperados.has(slot)) continue;

    if (!agrupados.has(venda.data)) {
      agrupados.set(venda.data, { total: 0, slots: new Set() });
    }
    const dia = agrupados.get(venda.data);
    dia.total += Number(venda.valor_vendido || 0);
    dia.slots.add(slot);
  }

  return new Map(
    [...agrupados]
      .filter(([, dia]) =>
        slotsEsperados.size > 0 &&
        dia.slots.size === slotsEsperados.size &&
        [...slotsEsperados].every((slot) => dia.slots.has(slot)))
      .map(([data, dia]) => [data, dia.total]),
  );
}

function somaAteDia(mapa, ano, numeroMes, diaLimite) {
  let soma = 0;
  for (let dia = 1; dia <= diaLimite; dia += 1) {
    const data = `${ano}-${String(numeroMes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    if (!mapa.has(data)) return null;
    soma += mapa.get(data);
  }
  return soma;
}

export function analisarHistoricoMes({
  historicos = [],
  vendasAtuais = [],
  lojas = [],
  ano,
  numeroMes,
  diaCorte = 0,
  tipo = "andamento",
}) {
  const anos = [ano - 2, ano - 1];
  const resumo = anos.map((anoHistorico) => {
    const ultimoDia = new Date(anoHistorico, numeroMes, 0).getDate();
    const dias = resumoDiario(historicos, anoHistorico, numeroMes, lojas);
    const diasCompletos = dias.size;
    const total = [...dias.values()].reduce((soma, valor) => soma + valor, 0);

    return {
      ano: anoHistorico,
      ultimoDia,
      dias,
      diasCompletos,
      confiavel: diasCompletos >= Math.ceil(ultimoDia * COBERTURA_MINIMA),
      mediaDiaria: diasCompletos ? total / diasCompletos : null,
      total,
    };
  });

  const referencias = resumo.filter((item) => item.confiavel);
  const datasHistoricas = referencias.flatMap((item) =>
    [...item.dias].map(([data, total]) => [data, { total }]),
  );
  const { diaForte, diaFraco, situacao } =
    extremosDiasSemana(datasHistoricas, NOMES_SEMANA);

  const variacaoMediaDiaria =
    referencias.length === 2 && referencias[0].mediaDiaria > 0
      ? ((referencias[1].mediaDiaria / referencias[0].mediaDiaria) - 1) * 100
      : null;

  const ultimoDiaAtual = new Date(ano, numeroMes, 0).getDate();
  const dataLimite = Math.max(0, Math.min(diaCorte, ultimoDiaAtual));
  const diasAtuais = resumoDiario(vendasAtuais, ano, numeroMes, lojas);
  let diaComparacao = 0;
  for (let dia = 1; dia <= dataLimite; dia += 1) {
    if (somaAteDia(diasAtuais, ano, numeroMes, dia) === null) break;
    diaComparacao = dia;
  }

  // Somente intervalos completos, começando no dia 1, são comparáveis.
  const comparaveis = diaComparacao >= 3
    ? referencias.map((referencia) => ({
        ...referencia,
        acumulado: somaAteDia(
          referencia.dias, referencia.ano, numeroMes, diaComparacao,
        ),
      })).filter((item) => item.acumulado !== null)
    : [];

  const atualAteCorte = diaComparacao >= 3
    ? somaAteDia(diasAtuais, ano, numeroMes, diaComparacao)
    : null;
  const mediaHistoricaAteCorte = comparaveis.length
    ? comparaveis.reduce((total, item) => total + item.acumulado, 0) / comparaveis.length
    : null;
  const comparacao =
    atualAteCorte !== null && mediaHistoricaAteCorte > 0
      ? {
          dia: diaComparacao,
          anos: comparaveis.map((item) => item.ano),
          atual: atualAteCorte,
          historico: mediaHistoricaAteCorte,
          variacao: ((atualAteCorte / mediaHistoricaAteCorte) - 1) * 100,
        }
      : null;

  // Projeção só com meses históricos integralmente lançados; não preenche
  // datas ausentes com zero nem extrapola lançamentos parciais do mês atual.
  const anosCompletos = comparaveis.filter((item) =>
    item.diasCompletos === item.ultimoDia && item.total > 0);
  const fracoes = anosCompletos.map((item) => item.acumulado / item.total);
  const fracaoMedia = fracoes.length
    ? fracoes.reduce((soma, valor) => soma + valor, 0) / fracoes.length
    : 0;
  const projecao =
    tipo !== "futuro" && tipo !== "encerrado" &&
    diaComparacao >= 5 && diaComparacao < ultimoDiaAtual &&
    fracaoMedia > 0 && atualAteCorte !== null
      ? {
          valor: atualAteCorte / fracaoMedia,
          dia: diaComparacao,
          anos: anosCompletos.map((item) => item.ano),
        }
      : null;

  return {
    referencias: referencias.map((item) => ({
      ano: item.ano,
      diasCompletos: item.diasCompletos,
      ultimoDia: item.ultimoDia,
    })),
    diaForte,
    diaFraco,
    situacaoDias: situacao,
    variacaoMediaDiaria,
    comparacao,
    projecao,
  };
}
