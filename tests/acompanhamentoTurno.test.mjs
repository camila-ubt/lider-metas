import assert from "node:assert/strict";
import test from "node:test";
import { calcularAcompanhamentoTurno, projetarMetasAmanha } from "../src/lib/acompanhamentoTurno.mjs";

const lojas = [
  { id: 1, codigo: "CB" },
  { id: 2, codigo: "AA" },
  { id: 3, codigo: "AB" },
];
const metas = lojas.map((loja, indice) => ({
  loja_id: loja.id,
  periodo: "noite",
  valor_meta: [30000, 24000, 18000][indice],
}));

function calcular(extra = {}) {
  return calcularAcompanhamentoTurno({
    lojas, metas, mes: "2026-09", data: "2026-09-11", periodo: "noite",
    ...extra,
  });
}

test("sem histórico, meta ajustada distribui a meta mensal pelos turnos restantes", () => {
  const resultado = calcular();
  assert.equal(resultado.diasRestantes, 20);
  assert.deepEqual(resultado.porLoja.map((loja) => loja.meta), [1500, 1200, 900]);
  assert.equal(resultado.metaTotal, 3600);
  assert.equal(resultado.metaFixaTotal, 2400);
});

test("meta ajustada cresce quando o mês está abaixo do ritmo", () => {
  const resultado = calcular({
    lojas: lojas.slice(0, 1),
    vendas: [{ data: "2026-09-10", loja_id: 1, periodo: "noite", valor_vendido: 6000 }],
  });
  assert.equal(resultado.porLoja[0].meta, 1200);
  assert.equal(resultado.porLoja[0].metaFixa, 1000);
});

test("meta ajustada diminui quando as vendas anteriores estão adiantadas", () => {
  const resultado = calcular({
    lojas: lojas.slice(0, 1),
    vendas: [{ data: "2026-09-10", loja_id: 1, periodo: "noite", valor_vendido: 12000 }],
  });
  assert.equal(resultado.porLoja[0].meta, 900);
});

test("diferencia Meta, Super e Mega no cálculo mensal ajustado", () => {
  assert.deepEqual([100, 110, 120].map((nivel) => calcular({
    lojas: lojas.slice(0, 1), nivel,
    vendas: [{ data: "2026-09-10", loja_id: 1, periodo: "noite", valor_vendido: 10000 }],
  }).metaTotal), [1000, 1150, 1300]);
});

test("não conta vendas de hoje, de outros turnos ou de outro mês no histórico", () => {
  const resultado = calcular({
    lojas: lojas.slice(0, 1),
    vendas: [
      { data: "2026-09-11", loja_id: 1, periodo: "noite", valor_vendido: 10000 },
      { data: "2026-09-10", loja_id: 1, periodo: "manha", valor_vendido: 4000 },
      { data: "2026-08-31", loja_id: 1, periodo: "noite", valor_vendido: 5000 },
      { data: "2026-09-10", loja_id: 2, periodo: "noite", valor_vendido: 2000 },
    ],
    vendasEmCentavos: { 1: "20000" },
  });
  assert.equal(resultado.metaTotal, 1500);
  assert.equal(resultado.porLoja[0].falta, 1300);
});

test("excedente de loja no mês reduz a meta coletiva sem alterar as metas individuais", () => {
  const resultado = calcular({
    vendas: [
      { data: "2026-09-10", loja_id: 1, periodo: "noite", valor_vendido: 3000 },
      { data: "2026-09-10", loja_id: 2, periodo: "noite", valor_vendido: 30000 },
      { data: "2026-09-10", loja_id: 3, periodo: "noite", valor_vendido: 3000 },
    ],
    vendasEmCentavos: { 1: "100000", 2: "50000", 3: "30000" },
  });
  assert.deepEqual(resultado.porLoja.map((loja) => loja.meta), [1350, 0, 750]);
  assert.equal(resultado.metaTotal, 1800);
  assert.equal(resultado.faltaGeral, 0);
  assert.equal(resultado.porLoja[0].falta, 350);
  assert.equal(resultado.porLoja[2].falta, 450);
});

test("compensa excedente digitado apenas no geral do turno", () => {
  const resultado = calcular({
    lojas: lojas.slice(0, 1), metas: metas.slice(0, 1),
    data: "2026-09-01",
    vendasEmCentavos: { 1: "130000" },
  });
  assert.equal(resultado.porLoja[0].falta, 0);
  assert.equal(resultado.porLoja[0].excedente, 300);
  assert.equal(resultado.faltaGeral, 0);
});

test("valores são arredondados em centavos e incluem o dia atual", () => {
  const resultado = calcular({
    lojas: lojas.slice(0, 1),
    metas: [{ loja_id: 1, periodo: "noite", valor_meta: 101 }],
    mes: "2026-10",
    data: "2026-10-10",
  });
  assert.equal(resultado.diasRestantes, 22);
  assert.equal(resultado.meta, undefined);
  assert.equal(resultado.metaTotal, 4.60);
});

test("não calcula total coletivo com meta de loja ausente", () => {
  const resultado = calcular({
    metas: metas.slice(0, 2),
    vendasEmCentavos: { 1: "5000" },
  });
  assert.equal(resultado.metasCompletas, false);
  assert.equal(resultado.metaTotal, null);
  assert.equal(resultado.faltaGeral, null);
  assert.equal(resultado.porLoja[2].meta, null);
});

test("manhã usa só suas metas e vendas", () => {
  const resultado = calcular({
    lojas: lojas.slice(0, 1),
    metas: [...metas, { loja_id: 1, periodo: "manha", valor_meta: 15000 }],
    periodo: "manha",
    vendas: [
      { data: "2026-09-10", loja_id: 1, periodo: "noite", valor_vendido: 8000 },
      { data: "2026-09-10", loja_id: 1, periodo: "manha", valor_vendido: 5000 },
    ],
  });
  assert.equal(resultado.metaTotal, 500);
});

test("não usa meta de período com data inválida", () => {
  const resultado = calcular({ data: "2026-10-01" });
  assert.equal(resultado.metasCompletas, false);
  assert.equal(resultado.metaTotal, null);
});


test("projeta as três faixas gerais com as vendas informadas hoje", () => {
  const projecao = projetarMetasAmanha({
    lojas: lojas.slice(0, 1),
    metas: metas.slice(0, 1),
    vendas: [{ data: "2026-09-10", loja_id: 1, periodo: "noite", valor_vendido: 6000 }],
    vendasEmCentavos: { 1: "200000" },
    mes: "2026-09",
    data: "2026-09-11",
    periodo: "noite",
  });
  assert.deepEqual(projecao.map((item) => item.metaHoje), [1200, 1350, 1500]);
  assert.deepEqual(projecao.map((item) => item.metaAmanha), [1157.90, 1315.79, 1473.69]);
  assert.ok(projecao.every((item) => item.variacaoPercentual < 0));
});

test("meta geral de amanhã cresce com vendas abaixo do necessário", () => {
  const projecao = projetarMetasAmanha({
    lojas: lojas.slice(0, 1), metas: metas.slice(0, 1),
    vendas: [{ data: "2026-09-10", loja_id: 1, periodo: "noite", valor_vendido: 6000 }],
    vendasEmCentavos: { 1: "10000" },
    mes: "2026-09", data: "2026-09-11", periodo: "noite",
  });
  assert.equal(projecao[0].metaHoje, 1200);
  assert.equal(projecao[0].metaAmanha, 1257.90);
  assert.ok(projecao[0].variacaoPercentual > 0);
});

test("projeção substitui venda oficial do dia sem duplicar e compensa entre lojas", () => {
  const projecao = projetarMetasAmanha({
    lojas: lojas.slice(0, 2), metas: metas.slice(0, 2),
    vendas: [
      { data: "2026-09-10", loja_id: 1, periodo: "noite", valor_vendido: 6000 },
      { data: "2026-09-11", loja_id: 1, periodo: "noite", valor_vendido: 9000 },
      { data: "2026-09-11", loja_id: 2, periodo: "manha", valor_vendido: 5000 },
    ],
    vendasEmCentavos: { 1: "200000", 2: "400000" },
    mes: "2026-09", data: "2026-09-11", periodo: "noite",
  });
  assert.equal(projecao[0].metaHoje, 2400);
  assert.equal(projecao[0].metaAmanha, 2210.53);
});

test("não projeta após o último dia ou com metas incompletas", () => {
  const base = { lojas, metas, mes: "2026-09", periodo: "noite", data: "2026-09-30" };
  assert.equal(projetarMetasAmanha(base), null);
  assert.equal(projetarMetasAmanha({ ...base, data: "2026-09-11", metas: metas.slice(0, 2) }), null);
});

test("quando meta mensal geral já está zerada, não inventa variação percentual", () => {
  const projecao = projetarMetasAmanha({
    lojas: lojas.slice(0, 1), metas: metas.slice(0, 1),
    vendas: [{ data: "2026-09-10", loja_id: 1, periodo: "noite", valor_vendido: 30000 }],
    vendasEmCentavos: { 1: "100000" },
    mes: "2026-09", data: "2026-09-11", periodo: "noite",
  });
  assert.equal(projecao[0].metaHoje, 0);
  assert.equal(projecao[0].metaAmanha, 0);
  assert.equal(projecao[0].variacaoPercentual, null);
});
