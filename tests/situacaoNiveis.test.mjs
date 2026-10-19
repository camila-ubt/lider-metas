import assert from "node:assert/strict";
import test from "node:test";

import { descreverSituacaoNivel } from "../src/lib/situacaoNiveis.mjs";

test("jornada usa o valor vendido ao calcular cada nível", () => {
  const base = { vendido: 93687.27, diasRestantes: 14, quantidadeLojas: 3 };
  const meta = descreverSituacaoNivel({ ...base, alvo: 120400 });
  const supermeta = descreverSituacaoNivel({ ...base, alvo: 132440 });
  const megameta = descreverSituacaoNivel({ ...base, alvo: 144480 });

  assert.match(meta.texto, /26\.712,73/);
  assert.match(meta.texto, /1\.908,05\/dia/);
  assert.match(meta.porLojaDia, /636,02\/loja\/dia/);
  assert.match(supermeta.texto, /38\.752,73/);
  assert.match(megameta.texto, /50\.792,73/);
  assert.equal(meta.atingida, false);
});

test("meta alcançada no mês atual indica Batida, sem valor faltante", () => {
  const resultado = descreverSituacaoNivel({ alvo: 120400, vendido: 130000, diasRestantes: 8 });
  assert.deepEqual(resultado, { atingida: true, texto: "Batida", porLojaDia: null });
});

test("meta alcançada em mês encerrado indica Conquistada", () => {
  const resultado = descreverSituacaoNivel({ alvo: 120400, vendido: 130000, encerrado: true });
  assert.deepEqual(resultado, { atingida: true, texto: "Conquistada", porLojaDia: null });
});

test("mês encerrado abaixo da meta mostra somente o saldo não alcançado", () => {
  const resultado = descreverSituacaoNivel({ alvo: 120400, vendido: 110400, encerrado: true });
  assert.equal(resultado.atingida, false);
  assert.match(resultado.texto, /^Faltaram /);
  assert.match(resultado.texto, /10\.000,00/);
  assert.equal(resultado.porLojaDia, null);
});

test("sem meta e sem dias restantes não gera divisão indevida", () => {
  assert.equal(descreverSituacaoNivel({ alvo: 0, vendido: 100 }).texto, "Sem meta");
  const resultado = descreverSituacaoNivel({ alvo: 100, vendido: 50, diasRestantes: 0 });
  assert.match(resultado.texto, /^Faltam /);
  assert.doesNotMatch(resultado.texto, /\/dia/);
  assert.equal(resultado.porLojaDia, null);
});
