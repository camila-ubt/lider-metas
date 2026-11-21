import assert from "node:assert/strict";
import test from "node:test";
import { verificarQualidadeLancamentos } from "../src/lib/qualidadeDados.mjs";

const lojas = [{ id: 1 }, { id: 2 }];
const meta = [
  { loja_id: 1, periodo: "manha", valor_meta: 3000 },
  { loja_id: 1, periodo: "noite", valor_meta: 4000 },
];
const vendas = (dias = 5) => Array.from({ length: dias }, (_, i) => ({
  data: "2026-11-" + String(i + 1).padStart(2, "0"),
  loja_id: 1, periodo: "manha", valor_vendido: i === 1 ? 0 : 100,
}));
const validar = (registros, extras = {}) => verificarQualidadeLancamentos({
  vendas: registros, metas: meta, lojas, ano: 2026, numeroMes: 11,
  diaConcluido: 5, filtroLoja: "1", filtroPeriodo: "manha", ...extras,
});

test("ausência não é zero, mas zero explícito é lançamento válido", () => {
  assert.equal(validar(vendas()).status, "ok");
  const comLacuna = validar(vendas().filter((v) => v.data !== "2026-11-02"));
  assert.equal(comLacuna.faltantes, 1);
  assert.equal(comLacuna.status, "inconsistente");
});

test("identifica duplicatas, valores negativos e metadados incompatíveis", () => {
  const base = vendas();
  const r = validar([...base, base[3], {
    data: "2026-11-03", loja_id: 1, periodo: "manha", valor_vendido: -1,
  }]);
  assert.equal(r.duplicados, 1);
  assert.equal(r.invalidos, 1);
  assert.equal(r.faltantes, 0);
});

test("não exige venda de amanhã nem turno/loja fora dos filtros", () => {
  const r = validar([...vendas(), { data: "2026-11-06", loja_id: 1,
    periodo: "manha", valor_vendido: 120 }]);
  assert.equal(r.status, "ok");
  assert.equal(r.faltantes, 0);
});

test("identifica meta ausente, repetida e de valor inválido", () => {
  const ausente = validar(vendas(), { metas: [] });
  assert.equal(ausente.metasAusentes, 1);
  const repetida = validar(vendas(), { metas: [
    meta[0], { ...meta[0], valor_meta: -10 },
  ] });
  assert.equal(repetida.metasDuplicadas, 1);
  assert.equal(repetida.metasInvalidas, 1);
});
