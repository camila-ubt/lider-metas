import assert from "node:assert/strict";
import test from "node:test";

import { calcularMetaPorLojaDia } from "../src/lib/metaPorLojaDia.mjs";

test("meta diária por loja divide somente o saldo da Meta fixa", () => {
  const valor = calcularMetaPorLojaDia({
    meta: 120400,
    vendido: 110864.92,
    diasRestantes: 9,
    quantidadeLojas: 3,
  });
  assert.equal(valor.toFixed(2), "353.15");
});

test("não confunde Supermeta com a Meta fixa mesmo se a jornada avançar", () => {
  assert.equal(calcularMetaPorLojaDia({
    meta: 1000, vendido: 1100, diasRestantes: 5, quantidadeLojas: 2,
  }), 0);
});

test("sem dias ou lojas disponíveis evita divisão por zero", () => {
  assert.equal(calcularMetaPorLojaDia({
    meta: 1000, vendido: 200, diasRestantes: 0, quantidadeLojas: 3,
  }), null);
  assert.equal(calcularMetaPorLojaDia({
    meta: 1000, vendido: 200, diasRestantes: 8, quantidadeLojas: 0,
  }), null);
  assert.equal(calcularMetaPorLojaDia({
    meta: 0, vendido: 0, diasRestantes: 8, quantidadeLojas: 3,
  }), null);
});
