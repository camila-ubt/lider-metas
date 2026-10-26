import assert from "node:assert/strict";
import test from "node:test";

import { calcularMetaPorLojaDia } from "../src/lib/metaPorLojaDia.mjs";

const jornadaAtiva = (nome, valor) => ({
  alvo: { nome, valor },
  completa: false,
  semMeta: false,
});

test("antes de bater a Meta, divide o saldo da Meta por dias e lojas restantes", () => {
  const valor = calcularMetaPorLojaDia({
    jornada: jornadaAtiva("Meta", 120400),
    vendido: 110864.92,
    diasRestantes: 9,
    quantidadeLojas: 3,
  });
  assert.equal(valor.toFixed(2), "353.15");
});

test("após bater a Meta, passa a calcular a Supermeta por loja/dia", () => {
  const valor = calcularMetaPorLojaDia({
    jornada: jornadaAtiva("Supermeta", 132440),
    vendido: 120680.96,
    diasRestantes: 6,
    quantidadeLojas: 3,
  });
  assert.equal(valor.toFixed(2), "653.28");
});

test("após bater a Supermeta, calcula o saldo da Megameta", () => {
  const valor = calcularMetaPorLojaDia({
    jornada: jornadaAtiva("Megameta", 144480),
    vendido: 132440,
    diasRestantes: 4,
    quantidadeLojas: 3,
  });
  assert.equal(valor.toFixed(2), "1003.33");
});

test("após conquistar a Megameta, não exibe valor para uma próxima etapa inexistente", () => {
  assert.equal(calcularMetaPorLojaDia({
    jornada: { alvo: { nome: "Megameta", valor: 144480 }, completa: true, semMeta: false },
    vendido: 150000,
    diasRestantes: 3,
    quantidadeLojas: 3,
  }), null);
});

test("sem meta, dias ou lojas disponíveis evita divisão inválida", () => {
  assert.equal(calcularMetaPorLojaDia({
    jornada: jornadaAtiva("Meta", 1000), vendido: 200, diasRestantes: 0, quantidadeLojas: 3,
  }), null);
  assert.equal(calcularMetaPorLojaDia({
    jornada: jornadaAtiva("Meta", 1000), vendido: 200, diasRestantes: 8, quantidadeLojas: 0,
  }), null);
  assert.equal(calcularMetaPorLojaDia({
    jornada: { alvo: { nome: "Meta", valor: 0 }, completa: false, semMeta: true },
    vendido: 0, diasRestantes: 8, quantidadeLojas: 3,
  }), null);
});
