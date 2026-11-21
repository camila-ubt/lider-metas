import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raiz = new URL("../", import.meta.url);
const ler = (nome) => readFile(new URL(nome, raiz), "utf8");

test("o painel mantém o aviso de pendências sem afirmar que a projeção é provisória", async () => {
  const fonte = await ler("src/components/DashboardEstavelV2.js");
  assert.match(fonte, /pendentesProjecao > 0/);
  assert.match(fonte, /lançamentos encerrados ainda pendentes/);
  assert.doesNotMatch(fonte, /A projeção é provisória/);
});

test("o histórico pinta piora em vermelho e melhora em verde nos dois indicadores", async () => {
  const [fonte, css] = await Promise.all([
    ler("src/components/HistoricoMetaLojaDia.js"),
    ler("src/components/DashboardEstavelV2.module.css"),
  ]);
  assert.match(fonte, /if \(valor > 0\) return styles\.metaHistoricoPiora/);
  assert.match(fonte, /if \(valor < 0\) return styles\.metaHistoricoMelhora/);
  assert.match(fonte, /className=\{corDaVariacao\(selecionado\.desvioPercentual\)\}/);
  assert.match(fonte, /className=\{corDaVariacao\(variacao\)\}/);
  assert.match(css, /\.metaHistoricoValores \.metaHistoricoPiora \{ color: #a3324c; \}/);
  assert.match(css, /\.metaHistoricoValores \.metaHistoricoMelhora \{ color: #2c7243; \}/);
});
