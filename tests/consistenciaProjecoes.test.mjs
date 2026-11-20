import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function ler(arquivo) {
  return readFile(new URL("../" + arquivo, import.meta.url), "utf8");
}

test("o único cálculo de chance em uso é o modelo de meses históricos", async () => {
  const card = await ler("src/components/ProbabilidadesMetas.js");
  const modelo = await ler("src/lib/probabilidadesHistoricas.mjs");
  const antigo = await ler("src/lib/analiseGerencial.js");
  const extras = await ler("src/components/AppEnhancements.js");
  const indicadores = await ler("src/lib/indicadoresGerenciais.mjs");

  assert.match(card, /estimarChancesHistoricas/);
  assert.match(modelo, /mesesMesmoMes/);
  assert.match(modelo, /mesesApoio/);
  assert.doesNotMatch(antigo, /probabilidadeAtingir|faixaEstimada|distribuicaoNormalAcumulada/);
  assert.doesNotMatch(extras, /AjusteProbabilidades/);
  assert.doesNotMatch(indicadores, /probabilidades: \{|const faixa = null/);
});

test("o cartão distingue novembro histórico dos meses auxiliares", async () => {
  const card = await ler("src/components/ProbabilidadesMetas.js");
  assert.match(card, /Mesmo mês:/);
  assert.match(card, /mesesApoio/);
  assert.doesNotMatch(card, /meses usados/);
});

test("projeções de fechamento têm um único motor operacional", async () => {
  for (const nome of [
    "src/components/DashboardEstavelV2.js",
    "src/components/FechamentoMensal.js",
    "src/components/ResumoLojasFechamento.js",
    "src/components/PainelReuniao.js",
    "src/components/AnaliseGerencial.js",
    "src/lib/indicadoresGerenciais.mjs",
    "src/lib/periodoMaisAtrasado.mjs",
    "src/lib/validacaoProjecoes.mjs",
  ]) {
    assert.match(await ler(nome), /calcularProjecaoTurno/, nome);
  }
  assert.match(await ler("src/components/InteligenciaGerencial.js"),
    /analisarIndicadoresGerenciais/);
  assert.doesNotMatch(await ler("src/lib/historicoMes.mjs"),
    /projecao:/);
});

test("meta necessária de amanhã não é descrita como previsão estatística", async () => {
  const turno = await ler("src/components/AcompanhamentoTurno.js");
  assert.match(turno, /Meta necessária amanhã/);
  assert.doesNotMatch(turno, /Projeção com as vendas informadas até agora/);
});
