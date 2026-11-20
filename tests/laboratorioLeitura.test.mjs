import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("o laboratorio principal preserva a tabela original e identifica as datas de corte", async () => {
  const codigo = await readFile(new URL("../src/components/LaboratorioValidacao.js", import.meta.url), "utf8");
  assert.match(codigo, /Simular fechamento de/);
  assert.match(codigo, /Fechamento real/);
  assert.match(codigo, /Erro \(R\$\)/);
  assert.match(codigo, /Erro \(%\)/);
  assert.match(codigo, /\[5, 10, 15, 20, 25\]/);
  assert.match(codigo, /quanto o sistema previa/);
  assert.match(codigo, /para o fechamento do mês/);
  assert.match(codigo, /Comparar outros métodos \(opcional\)/);
  assert.doesNotMatch(codigo, /[Pp]revisões dos cinco dias/);
});

test("outros metodos nao substituem a tabela do laboratorio", async () => {
  const principal = await readFile(new URL("../src/components/LaboratorioValidacao.js", import.meta.url), "utf8");
  const avancado = await readFile(new URL("../src/components/LaboratorioComparacaoAvancada.js", import.meta.url), "utf8");
  assert.match(principal, /validarProjecoesHistoricas/);
  assert.match(principal, /LaboratorioComparacaoAvancada/);
  assert.match(avancado, /compararMetodosProjecao/);
  assert.match(avancado, /ComparativoSeisMeses/);
});
