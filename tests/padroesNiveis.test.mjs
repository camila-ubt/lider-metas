import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { nivelDoResultado } from "../src/lib/contextoMes.js";
import { classificarProjecao } from "../src/lib/classificarProjecao.mjs";

const casos = [
  ["src/components/FechamentoMensal.js", [
    "const supermeta = meta * 1.1;",
    "const megameta = meta * 1.2;",
    "dados.totalMeta * 1.1",
    "dados.totalMeta * 1.2",
    "loja.meta * 1.1",
    "loja.meta * 1.2",
  ]],
  ["src/components/ResumoLojasFechamento.js", [
    '{ nome: "Super", valor: meta * 1.1 }',
    '{ nome: "Mega", valor: meta * 1.2 }',
  ]],
  ["src/components/AnaliseGerencial.js", [
    'vendido >= meta * 1.1) return "Supermeta"',
    'vendido >= meta * 1.2) return "Megameta"',
    "periodo.percentual < 110",
  ]],
  ["src/components/LiderMetas.js", [
    "Supermeta e Megameta são calculadas automaticamente em 110% e 120%.",
  ]],
];

for (const [caminho, trechos] of casos) {
  test("faixas consistentes em " + caminho, async () => {
    const arquivo = await readFile(new URL("../" + caminho, import.meta.url), "utf8");
    for (const trecho of trechos) {
      assert.ok(arquivo.includes(trecho), "Trecho esperado ausente: " + trecho);
    }
    assert.doesNotMatch(arquivo, /130%|meta\s*\*\s*1\.3|totalMeta\s*\*\s*1\.3/);
  });
}

test("limites do resultado e da projeção são 100%, 110% e 120%", () => {
  for (const [valor, nivel] of [
    [999.99, "Abaixo da Meta"],
    [1000, "Meta"],
    [1099.99, "Meta"],
    [1100, "Supermeta"],
    [1199.99, "Supermeta"],
    [1200, "Megameta"],
    [1300, "Megameta"],
  ]) {
    assert.equal(nivelDoResultado(valor, 1000), nivel);
    assert.equal(classificarProjecao(valor, 1000).rotulo, nivel);
  }
});
