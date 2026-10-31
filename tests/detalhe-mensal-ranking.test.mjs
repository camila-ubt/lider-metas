import test from "node:test";
import assert from "node:assert/strict";
import { compararVendidoComMeta } from "../src/lib/detalheMensalRanking.mjs";

test("indica excedente de meta em reais para o total da loja e para o turno", () => {
  assert.deepEqual(compararVendidoComMeta(55183.51, 49000), {
    situacao: "acima",
    diferenca: 6183.51,
    percentual: 55183.51 / 49000 * 100,
  });
  assert.equal(compararVendidoComMeta(29879.26, 29400).diferenca, 479.26);
});

test("indica falta para a meta quando as vendas ficam abaixo", () => {
  const r = compararVendidoComMeta(13467.93, 18100);
  assert.equal(r.situacao, "abaixo");
  assert.equal(r.diferenca, -4632.07);
});

test("meta atingida exatamente não é tratada como valor negativo", () => {
  const r = compararVendidoComMeta(20000, 20000);
  assert.equal(r.situacao, "atingida");
  assert.equal(r.diferenca, 0);
  assert.equal(r.percentual, 100);
});

test("sem meta configurada não exibe falsa diferença", () => {
  assert.deepEqual(compararVendidoComMeta(2400, 0), { situacao: "semMeta", diferenca: null, percentual: null });
  assert.deepEqual(compararVendidoComMeta(2400, 2000, false), { situacao: "semMeta", diferenca: null, percentual: null });
  assert.equal(compararVendidoComMeta(2400, NaN).situacao, "semMeta");
});
