import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

for (const caminho of [
  "../src/components/DetalhesProjecao.js",
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

test("projeção e histórico diário estão no KPI superior, não no rodapé", async () => {
  const [dashboard, detalhes, inteligencia, laboratorio] = await Promise.all([
    "DashboardEstavelV2.js", "DetalhesProjecao.js",
    "InteligenciaGerencial.js", "LaboratorioValidacao.js",
  ].map((nome) =>
    readFile(new URL("../src/components/" + nome, import.meta.url), "utf8")
  ));
  assert.match(dashboard, /setProjecaoDetalhesAbertos/);
  assert.match(dashboard, /<DetalhesProjecao/);
  assert.match(detalhes, /<ProbabilidadesMetas/);
  assert.match(detalhes, /<RegistroPrevisoes/);
  assert.match(detalhes, /filtroLoja/);
  assert.match(detalhes, /filtroPeriodo/);
  assert.doesNotMatch(inteligencia, /<ProbabilidadesMetas/);
  assert.doesNotMatch(laboratorio, /<RegistroPrevisoes/);
});
