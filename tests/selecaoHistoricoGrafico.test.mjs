import test from "node:test";
import assert from "node:assert/strict";
import { obterDiaPeloIndiceGrafico } from "../src/lib/selecaoHistoricoGrafico.mjs";

const dias = [{ dia: 17 }, { dia: 18 }, { dia: 19 }];

test("seleciona exatamente o dia pelo índice, mesmo com activeLabel desatualizado", () => {
  assert.equal(obterDiaPeloIndiceGrafico({ activeTooltipIndex: "2", activeLabel: "17" }, dias), 19);
  assert.equal(obterDiaPeloIndiceGrafico({ activeTooltipIndex: 1, activeLabel: 17 }, dias), 18);
  assert.equal(obterDiaPeloIndiceGrafico({ activeTooltipIndex: 0, activeLabel: 19 }, dias), 17);
});

test("usa activeIndex se activeTooltipIndex não estiver disponível", () => {
  assert.equal(obterDiaPeloIndiceGrafico({ activeIndex: "2" }, dias), 19);
});

test("ignora cliques fora de pontos válidos", () => {
  for (const estado of [null, {}, { activeTooltipIndex: "-1" }, { activeTooltipIndex: "3" }, { activeTooltipIndex: "NaN" }, { activeTooltipIndex: "" }]) {
    assert.equal(obterDiaPeloIndiceGrafico(estado, dias), null);
  }
});
