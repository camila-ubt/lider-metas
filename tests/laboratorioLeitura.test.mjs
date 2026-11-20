import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("laboratório descreve os cinco momentos como projeções do fechamento do mês", async () => {
  const codigo = await readFile(new URL("../src/components/LaboratorioValidacao.js", import.meta.url), "utf8");
  assert.match(codigo, /previsões mudaram durante o mês/);
  assert.match(codigo, /até o fim do mês/);
  assert.match(codigo, /dias 5, 10, 15, 20 e 25/);
  assert.doesNotMatch(codigo, /[Pp]revisões dos cinco dias/);
  assert.match(codigo, /Erro médio de cada método/);
  assert.match(codigo, /Entender as métricas técnicas/);
});
