import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

for (const caminho of [
  "../src/components/InteligenciaGerencial.js",
  "../src/components/AnaliseGerencial.js",
]) {
  test("projeção de fechamento sem blocos explicativos em " + caminho, async () => {
    const codigo = await readFile(new URL(caminho, import.meta.url), "utf8");
    assert.match(codigo, /Fechamento estimado/);
    assert.doesNotMatch(codigo, /A venda da noite é registrada na manhã seguinte/);
    assert.doesNotMatch(codigo, /Percentuais de chance de atingir/);
    assert.doesNotMatch(codigo, /As chances percentuais e faixas estatísticas ficam indisponíveis/);
  });
}
