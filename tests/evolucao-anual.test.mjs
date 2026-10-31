import assert from "node:assert/strict";
import test from "node:test";
import {
  resumirSerieAnual, montarComparativo, compararAnosEquivalentes,
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
