import assert from "node:assert/strict";
import test from "node:test";
import { calcularAcompanhamentoTurno } from "../src/lib/acompanhamentoTurno.mjs";

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

test("calcula metas diárias do turno conforme impressão, com 100, 110 e 120%", () => {
  assert.deepEqual(
    [100, 110, 120].map((nivel) => calcularAcompanhamentoTurno({
      lojas, metas, mes: "2026-09", periodo: "noite", nivel,
    }).metaTotal),
    [2400, 2640, 2880],
  );
});

test("mostra faltas por loja e compensa excedentes somente no geral", () => {
  const resultado = calcularAcompanhamentoTurno({
    lojas, metas, mes: "2026-09", periodo: "noite", nivel: 100,
    vendasEmCentavos: { 1: "130000", 2: "50000", 3: "40000" },
  });
  assert.equal(resultado.porLoja[0].falta, 0);
  assert.equal(resultado.porLoja[0].excedente, 300);
  assert.equal(resultado.porLoja[1].falta, 300);
  assert.equal(resultado.porLoja[2].falta, 200);
  assert.equal(resultado.faltaGeral, 200);
  assert.equal(resultado.mediaPorLoja.toFixed(2), "66.67");
});

test("não calcula total coletivo com meta de loja ausente", () => {
  const resultado = calcularAcompanhamentoTurno({
    lojas, metas: metas.slice(0, 2), mes: "2026-09",
    vendasEmCentavos: { 1: "5000" },
  });
  assert.equal(resultado.metasCompletas, false);
  assert.equal(resultado.metaTotal, null);
  assert.equal(resultado.faltaGeral, null);
  assert.equal(resultado.porLoja[2].meta, null);
});

test("manhã e noite usam metas diferentes", () => {
  const resultado = calcularAcompanhamentoTurno({
    lojas: lojas.slice(0, 1),
    metas: [...metas, { loja_id: 1, periodo: "manha", valor_meta: 15000 }],
    mes: "2026-09", periodo: "manha",
  });
  assert.equal(resultado.metaTotal, 500);
});
