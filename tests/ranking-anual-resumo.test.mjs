import assert from "node:assert/strict";
import test from "node:test";
import { resumirResultadosMensais } from "../src/lib/rankingAnual.mjs";

test("conta 6 de 9 meses válidos, ignorando mês parcial, futuro e sem meta", () => {
  const resultados = [
    ...Array.from({ length: 6 }, (_, i) => ({ mes: i + 1, nivel: "meta", percentual: 105 + i })),
    ...Array.from({ length: 3 }, (_, i) => ({ mes: i + 7, nivel: "abaixo", percentual: 70 + i })),
    { mes: 10, nivel: "parcial", percentual: 50 },
    { mes: 11, nivel: "futuro", percentual: null },
    { mes: 12, nivel: "semMeta", percentual: null },
  ];
  const resumo = resumirResultadosMensais(resultados);
  assert.equal(resumo.batidos, 6);
  assert.equal(resumo.meses, 9);
  assert.equal(resumo.taxa, 6 / 9);
  assert.equal(resumo.melhor.mes, 6);
  assert.equal(resumo.pior.mes, 7);
});

test("super e mega contam como meta atingida, inclusive valores de limite", () => {
  const resumo = resumirResultadosMensais([
    { mes: 1, nivel: "meta", percentual: 100 },
    { mes: 2, nivel: "super", percentual: 120 },
    { mes: 3, nivel: "mega", percentual: 130 },
    { mes: 4, nivel: "abaixo", percentual: 99.9 },
  ]);
  assert.equal(resumo.batidos, 3);
  assert.equal(resumo.meses, 4);
});

test("um ano sem meses válidos não gera ranking artificial", () => {
  assert.deepEqual(resumirResultadosMensais([
    { mes: 1, nivel: "parcial", percentual: 25 },
    { mes: 2, nivel: "futuro", percentual: null },
    { mes: 3, nivel: "semMeta", percentual: null },
  ]), { meses: 0, batidos: 0, taxa: -1, melhor: null, pior: null });
});

test("uma lista vazia também não é classificada", () => {
  assert.equal(resumirResultadosMensais([]).meses, 0);
});
