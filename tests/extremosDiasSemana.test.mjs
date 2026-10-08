import assert from "node:assert/strict";
import test from "node:test";
import { extremosDiasSemana } from "../src/lib/extremosDiasSemana.mjs";

const nomes = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const dias = (entradas) =>
  entradas.map(([data, total]) => [data, { total }]);

test("não atribui dia forte e fraco à única semana repetida", () => {
  const resultado = extremosDiasSemana(
    dias([["2026-10-01", 1500], ["2026-10-02", 2000], ["2026-10-08", 2440]]),
    nomes,
  );
  assert.deepEqual(resultado, {
    diaForte: null, diaFraco: null, situacao: "amostra",
  });
});

test("identifica extremos distintos a partir de duas ocorrências para cada dia", () => {
  const resultado = extremosDiasSemana(
    dias([
      ["2026-10-01", 2500], ["2026-10-02", 1000],
      ["2026-10-08", 1500], ["2026-10-09", 2000],
    ]),
    nomes,
  );
  assert.deepEqual(resultado, {
    diaForte: { nome: "quinta-feira", media: 2000, quantidade: 2 },
    diaFraco: { nome: "sexta-feira", media: 1500, quantidade: 2 },
    situacao: null,
  });
});

test("trata médias iguais como empate, não como melhor ou pior dia", () => {
  const resultado = extremosDiasSemana(
    dias([
      ["2026-10-01", 2000], ["2026-10-02", 1500],
      ["2026-10-08", 1000], ["2026-10-09", 1500],
    ]),
    nomes,
  );
  assert.deepEqual(resultado, {
    diaForte: null, diaFraco: null, situacao: "empate",
  });
});

test("não compara uma amostra com apenas um dia completo", () => {
  assert.deepEqual(
    extremosDiasSemana(dias([["2026-10-01", 1000]]), nomes),
    { diaForte: null, diaFraco: null, situacao: "amostra" },
  );
});
