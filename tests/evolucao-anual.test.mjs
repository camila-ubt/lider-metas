import assert from "node:assert/strict";
import test from "node:test";
import {
  alternarAnoHistorico, anosHistoricosDisponiveis,
  resumirSerieAnual, montarComparativo, compararAnosEquivalentes, detalharMesEvolucao,
  situacaoMetaMensal,
} from "../src/lib/evolucaoAnual.mjs";

const hoje = new Date(2026, 9, 31);
const vendas = [
  { data: "2026-01-03", loja_id: 1, periodo: "manha", valor_vendido: 100 },
  { data: "2026-01-03", loja_id: 1, periodo: "noite", valor_vendido: 200 },
  { data: "2026-01-03", loja_id: 2, periodo: "manha", valor_vendido: 50 },
  { data: "2026-01-03", loja_id: 2, periodo: "noite", valor_vendido: 50 },
  { data: "2026-10-30", loja_id: 1, periodo: "manha", valor_vendido: 20 },
  { data: "2026-11-01", loja_id: 1, periodo: "noite", valor_vendido: 999 },
];
const metas = [
  { mes: "2026-01-01", loja_id: 1, periodo: "manha", valor_meta: 100 },
  { mes: "2026-01-01", loja_id: 1, periodo: "noite", valor_meta: 100 },
  { mes: "2026-01-01", loja_id: 2, periodo: "manha", valor_meta: 50 },
  { mes: "2026-01-01", loja_id: 2, periodo: "noite", valor_meta: 50 },
  { mes: "2026-10-01", loja_id: 1, periodo: "manha", valor_meta: 100 },
];

test("soma as três lojas e os turnos antes de calcular o percentual", () => {
  const jan = resumirSerieAnual({ ano: 2026, lojasIds: [1, 2], vendas, metas, hoje })[0];
  assert.equal(jan.vendido, 400);
  assert.equal(jan.meta, 300);
  assert.equal(jan.percentual, 400 / 300 * 100);
  assert.equal(jan.temDados, true);
});

test("filtra apenas a manhã e a loja escolhida sem misturar vendas", () => {
  const manha = resumirSerieAnual({ ano: 2026, lojasIds: [1, 2], periodo: "manha", vendas, metas, hoje })[0];
  const loja1 = resumirSerieAnual({ ano: 2026, lojasIds: [1], periodo: "todos", vendas, metas, hoje })[0];
  assert.equal(manha.vendido, 150);
  assert.equal(manha.meta, 150);
  assert.equal(loja1.vendido, 300);
  assert.equal(loja1.meta, 200);
});

test("não inventa zero para mês sem lançamento nem mostra mês futuro", () => {
  const serie = resumirSerieAnual({ ano: 2026, lojasIds: [1, 2], vendas, metas, hoje });
  assert.equal(serie[1].vendido, null);
  assert.equal(serie[1].temDados, false);
  assert.equal(serie[9].parcial, true);
  assert.equal(serie[9].vendido, 20);
  assert.equal(serie[9].percentual, null); // faltam metas de um dos turnos e da segunda loja
  assert.equal(serie[10].vendido, null);
  assert.equal(serie[10].temDados, false);
});

test("gera acumulado sem preencher artificialmente lacunas", () => {
  const pontos = montarComparativo({
    2026: [
      { vendido: 100, temDados: true },
      { vendido: null, temDados: false },
      { vendido: 200, temDados: true },
    ],
    2025: [
      { vendido: 80, temDados: true },
      { vendido: 90, temDados: true },
      { vendido: null, temDados: false },
    ],
  }, [2026, 2025], "acumulado");
  assert.equal(pontos[0]["2026"], 100);
  assert.equal(pontos[1]["2026"], null);
  assert.equal(pontos[2]["2026"], 300);
  assert.equal(pontos[1]["2025"], 170);
  assert.equal(pontos[2]["2025"], null);
});

test("compara apenas meses fechados presentes nos dois anos", () => {
  const atual = [
    { mes: 1, vendido: 120, temDados: true, parcial: false },
    { mes: 2, vendido: 0, temDados: false, parcial: false },
    { mes: 3, vendido: 40, temDados: true, parcial: true },
  ];
  const anterior = [
    { mes: 1, vendido: 100, temDados: true },
    { mes: 2, vendido: 90, temDados: true },
    { mes: 3, vendido: 30, temDados: true },
  ];
  const r = compararAnosEquivalentes(atual, anterior);
  assert.equal(r.meses, 1);
  assert.equal(r.atual, 120);
  assert.equal(r.anterior, 100);
  assert.ok(Math.abs(r.percentual - 20) < 1e-9);
});

test("sem período anterior comparável, percentual fica ausente", () => {
  const r = compararAnosEquivalentes(
    [{ mes: 1, vendido: 100, temDados: true, parcial: false }],
    [{ mes: 1, vendido: null, temDados: false }]
  );
  assert.deepEqual(r, { meses: 0, atual: 0, anterior: 0, percentual: null });
});

test("detalhe do mês reúne vendido, meta e comparação com ano anterior", () => {
  const atual = [{ mes: 1, nome: "Jan", temDados: true, vendido: 150, meta: 100, percentual: 150, parcial: false }];
  const anterior = [{ mes: 1, nome: "Jan", temDados: true, vendido: 120, meta: 100, parcial: false }];
  const resultado = detalharMesEvolucao(atual, anterior, 1);
  assert.equal(resultado.vendido, 150);
  assert.equal(resultado.meta, 100);
  assert.equal(resultado.diferencaMeta, 50);
  assert.equal(resultado.vendidoAnterior, 120);
  assert.equal(resultado.diferencaAnterior, 30);
  assert.ok(Math.abs(resultado.variacaoAnterior - 25) < 1e-9);
});

test("detalhe não calcula variação anual para mês parcial", () => {
  const atual = [{ mes: 1, temDados: true, vendido: 40, meta: 100, parcial: true }];
  const anterior = [{ mes: 1, temDados: true, vendido: 120 }];
  const resultado = detalharMesEvolucao(atual, anterior, 1);
  assert.equal(resultado.diferencaMeta, -60);
  assert.equal(resultado.vendidoAnterior, 120);
  assert.equal(resultado.diferencaAnterior, null);
  assert.equal(resultado.variacaoAnterior, null);
});

test("detalhe de mês sem lançamentos ou sem base histórica não inventa comparação", () => {
  const atual = [{ mes: 1, temDados: false, vendido: null, meta: 200, parcial: false }];
  const anterior = [{ mes: 1, temDados: true, vendido: 0 }];
  const resultado = detalharMesEvolucao(atual, anterior, 1);
  assert.equal(resultado.diferencaMeta, null);
  assert.equal(resultado.vendidoAnterior, 0);
  assert.equal(resultado.variacaoAnterior, null);
  assert.equal(detalharMesEvolucao(atual, anterior, 0), null);
  assert.equal(detalharMesEvolucao(atual, anterior, 13), null);
});

test("não divide por zero quando o ano anterior teve faturamento zero", () => {
  const atual = [{ mes: 1, temDados: true, vendido: 75, meta: null, parcial: false }];
  const anterior = [{ mes: 1, temDados: true, vendido: 0 }];
  const resultado = detalharMesEvolucao(atual, anterior, 1);
  assert.equal(resultado.diferencaMeta, null);
  assert.equal(resultado.vendidoAnterior, 0);
  assert.equal(resultado.variacaoAnterior, null);
});

test("destaca como parcial somente o mês atual do ano em andamento", () => {
  const atual = resumirSerieAnual({ ano: 2026, lojasIds: [1], vendas, metas, hoje });
  assert.equal(atual.filter((item) => item.parcial).length, 1);
  assert.equal(atual[9].parcial, true);
  assert.equal(atual[8].parcial, false);
  assert.equal(atual[10].parcial, false);

  const historico = resumirSerieAnual({
    ano: 2025, lojasIds: [1],
    vendas: [{ data: "2025-10-10", loja_id: 1, periodo: "manha", valor_vendido: 200 }],
    metas: [], hoje,
  });
  assert.equal(historico[9].temDados, true);
  assert.equal(historico[9].parcial, false);
  assert.equal(historico.some((item) => item.parcial), false);
});

test("lista apenas anos anteriores disponíveis e respeita o início do histórico", () => {
  assert.deepEqual(anosHistoricosDisponiveis(2024), []);
  assert.deepEqual(anosHistoricosDisponiveis(2025), [2024]);
  assert.deepEqual(anosHistoricosDisponiveis(2027), [2026, 2025, 2024]);
});

test("permite escolher quais anos aparecem, mantendo no máximo duas comparações", () => {
  assert.deepEqual(alternarAnoHistorico([2026, 2025], 2025, 2027), [2026]);
  assert.deepEqual(alternarAnoHistorico([2026], 2024, 2027), [2026, 2024]);
  assert.deepEqual(alternarAnoHistorico([2026, 2025], 2024, 2027), [2026, 2025]);
  assert.deepEqual(alternarAnoHistorico([], 2024, 2027), [2024]);
  assert.deepEqual(alternarAnoHistorico([2025], 2027, 2027), [2025]);
  assert.deepEqual(alternarAnoHistorico([2026, 2025], 2024, 2025), [2024]);
});

test("tabela e gráfico usam somente os anos escolhidos", () => {
  const pontos = montarComparativo({
    2026: [{ vendido: 240, temDados: true }],
    2025: [{ vendido: 180, temDados: true }],
    2024: [{ vendido: 100, temDados: true }],
  }, [2026, 2024], "mensal");
  assert.equal(pontos[0]["2026"], 240);
  assert.equal(pontos[0]["2024"], 100);
  assert.equal(Object.hasOwn(pontos[0], "2025"), false);
});


test("meta abaixo no mês aberto usa presente, sem valor negativo", () => {
  const r = situacaoMetaMensal({ temDados: true, vendido: 250, meta: 500, parcial: true });
  assert.deepEqual(r, {
    titulo: "Ainda falta", valor: 250, complemento: "para atingir a meta", tom: "negativo",
  });
});

test("meta abaixo no mês encerrado usa passado e valor absoluto", () => {
  const r = situacaoMetaMensal({ temDados: true, vendido: 250, meta: 500, parcial: false });
  assert.deepEqual(r, {
    titulo: "Faltou", valor: 250, complemento: "para atingir a meta", tom: "negativo",
  });
});

test("meta exatamente atingida distingue mês em andamento de mês fechado", () => {
  assert.equal(situacaoMetaMensal({
    temDados: true, vendido: 500, meta: 500, parcial: true,
  }).titulo, "Meta já atingida");
  assert.equal(situacaoMetaMensal({
    temDados: true, vendido: 500, meta: 500, parcial: false,
  }).titulo, "Meta atingida");
});

test("meta superada distingue mês atual do encerrado e mostra somente excedente", () => {
  const aberto = situacaoMetaMensal({ temDados: true, vendido: 645.5, meta: 500, parcial: true });
  const fechado = situacaoMetaMensal({ temDados: true, vendido: 645.5, meta: 500, parcial: false });
  assert.equal(aberto.titulo, "Meta já superada em");
  assert.equal(fechado.titulo, "Meta superada em");
  assert.equal(aberto.valor, 145.5);
  assert.equal(fechado.valor, 145.5);
  assert.equal(fechado.tom, "positivo");
});

test("meta ou lançamentos ausentes não sugerem atraso nem meta atingida", () => {
  assert.deepEqual(situacaoMetaMensal(null), {
    titulo: "Sem vendas registradas", valor: null, complemento: "", tom: "neutro",
  });
  assert.equal(situacaoMetaMensal({
    temDados: false, vendido: null, meta: 400, parcial: false,
  }).titulo, "Sem vendas registradas");
  assert.equal(situacaoMetaMensal({
    temDados: true, vendido: 250, meta: null, parcial: true,
  }).titulo, "Meta indisponível");
  assert.equal(situacaoMetaMensal({
    temDados: true, vendido: 250, meta: 0, parcial: false,
  }).titulo, "Meta indisponível");
});

test("centavos determinam se meta foi atingida ou se ainda falta", () => {
  assert.equal(situacaoMetaMensal({
    temDados: true, vendido: 99.99, meta: 100, parcial: false,
  }).valor, 0.01);
  assert.equal(situacaoMetaMensal({
    temDados: true, vendido: 100, meta: 100, parcial: false,
  }).valor, null);
});

test("última data de vendas acompanha o mês e os filtros de loja e turno", () => {
  const registros = [
    { data: "2026-10-22", loja_id: 1, periodo: "manha", valor_vendido: 30 },
    { data: "2026-10-30", loja_id: 1, periodo: "manha", valor_vendido: 50 },
    { data: "2026-10-02", loja_id: 1, periodo: "manha", valor_vendido: 10 },
    { data: "2026-10-29", loja_id: 1, periodo: "noite", valor_vendido: 20 },
    { data: "2026-10-31", loja_id: 2, periodo: "noite", valor_vendido: 100 },
    { data: "2026-09-30", loja_id: 1, periodo: "manha", valor_vendido: 50 },
  ];
  const params = { ano: 2026, vendas: registros, metas: [], hoje };
  const geral = resumirSerieAnual({ ...params, lojasIds: [1, 2] });
  const soManha = resumirSerieAnual({ ...params, lojasIds: [1, 2], periodo: "manha" });
  const soLoja1 = resumirSerieAnual({ ...params, lojasIds: [1] });
  const soNoiteLoja1 = resumirSerieAnual({ ...params, lojasIds: [1], periodo: "noite" });
  assert.equal(geral[9].ultimaDataRegistro, "2026-10-31");
  assert.equal(soManha[9].ultimaDataRegistro, "2026-10-30");
  assert.equal(soLoja1[9].ultimaDataRegistro, "2026-10-30");
  assert.equal(soNoiteLoja1[9].ultimaDataRegistro, "2026-10-29");
  assert.equal(soManha[9].vendido, 90);
  assert.equal(geral[8].ultimaDataRegistro, "2026-09-30");
});

test("sem vendas no filtro ou em mês futuro não inventa data de registro", () => {
  const registros = [
    { data: "2026-10-30", loja_id: 1, periodo: "manha", valor_vendido: 20 },
    { data: "2026-11-01", loja_id: 1, periodo: "manha", valor_vendido: 50 },
  ];
  const lojaSemVendas = resumirSerieAnual({
    ano: 2026, lojasIds: [2], vendas: registros, metas: [], hoje,
  });
  const lojaComVendas = resumirSerieAnual({
    ano: 2026, lojasIds: [1], vendas: registros, metas: [], hoje,
  });
  assert.equal(lojaSemVendas[9].temDados, false);
  assert.equal(lojaSemVendas[9].ultimaDataRegistro, null);
  assert.equal(lojaComVendas[10].temDados, false);
  assert.equal(lojaComVendas[10].ultimaDataRegistro, null);
});

test("detalhe mensal mantém a última data da venda para apresentação", () => {
  const serie = resumirSerieAnual({
    ano: 2026, lojasIds: [1], vendas, metas, periodo: "manha", hoje,
  });
  const r = detalharMesEvolucao(serie, undefined, 10);
  assert.equal(r.parcial, true);
  assert.equal(r.ultimaDataRegistro, "2026-10-30");
  assert.equal(r.vendido, 20);
});
