import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("laboratorio preserva a tabela simples de previsoes e fechamento real", async () => {
  const codigo = await readFile(new URL("../src/components/LaboratorioValidacao.js", import.meta.url), "utf8");
  assert.match(codigo, /Simular fechamento de/);
  assert.match(codigo, /Fechamento real/);
  assert.match(codigo, /Erro \(R\$\)/);
  assert.match(codigo, /Erro \(%\)/);
  assert.match(codigo, /\[5, 10, 15, 20, 25\]/);
  assert.match(codigo, /quanto o sistema previa/);
  assert.match(codigo, /para o fechamento do mês/);
  assert.match(codigo, /validarProjecoesHistoricas/);
  assert.doesNotMatch(codigo, /[Pp]revisões dos cinco dias/);
  assert.doesNotMatch(codigo, /Comparar outros métodos|LaboratorioComparacaoAvancada/);
});
