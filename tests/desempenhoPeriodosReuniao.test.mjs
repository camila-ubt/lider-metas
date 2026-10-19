import assert from "node:assert/strict";
import test from "node:test";
import { classificarDesempenhoPeriodo, desempenhoPeriodosReuniao } from "../src/lib/desempenhoPeriodosReuniao.mjs";

const lojas = [{ id: 1 }, { id: 2 }];
const metas = lojas.flatMap((loja) =>
  ["manha", "noite"].map((periodo) => ({
    loja_id: loja.id, periodo, valor_meta: 3000,
  })),
);
const contexto = (tipo, diaCorte) => ({
  ano: 2026, numeroMes: 11, ultimoDia: 30, tipo, diaCorte,
});
function lancamento(dia, loja_id, periodo, valor_vendido) {
  return { data: `2026-11-${String(dia).padStart(2, "0")}`, loja_id, periodo, valor_vendido };
}
function dia(dia, periodo, valor = 100) {
  return lojas.map((loja) => lancamento(dia, loja.id, periodo, valor));
}
function calcular(vendas, tipo = "andamento", diaCorte = 2, minutosAgora = 1020, opcoes = {}) {
  return desempenhoPeriodosReuniao({
    lojas, metas, vendas, contexto: contexto(tipo, diaCorte),
    minutosAgora, ...opcoes,
  });
}

test("percentual parcial compara com meta proporcional aos dias encerrados por período", () => {
  const resultado = calcular([
    ...dia(1, "manha", 60),
    ...dia(2, "manha", 60),
    ...dia(1, "noite", 100),
    ...dia(2, "noite", 0),
  ]);
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].periodo, "manha");
  assert.equal(resultado[0].referencia, "parcial");
  assert.equal(resultado[0].percentual, 60);
  assert.equal(resultado[1].periodo, "noite");
  assert.equal(resultado[1].percentual, 100);
});

test("manhã atual não entra antes de encerrar às 16h", () => {
  const resultado = calcular([
    ...dia(1, "manha", 100),
    ...dia(2, "manha", 0),
  ], "andamento", 2, 959);
  assert.equal(resultado[0].percentual, 100);
});

test("a noite entra quando encerra e separa as referências dos períodos", () => {
  const vendas = [
    ...dia(1, "manha", 100),
    ...dia(2, "manha", 100),
    ...dia(1, "noite", 50),
    ...dia(2, "noite", 100),
  ];
  const antes = calcular(vendas, "andamento", 2, 1319);
  const depois = calcular(vendas, "andamento", 2, 1320);
  assert.equal(antes[1].percentual, 50);
  assert.equal(depois[1].percentual, 75);
});

test("lançamento incompleto não vira venda zero", () => {
  const vendas = [
    ...dia(1, "manha", 100),
    lancamento(2, 1, "manha", 0),
  ];
  assert.equal(calcular(vendas)[0].percentual, 100);
  const completo = calcular([...vendas, lancamento(2, 2, "manha", 0)]);
  assert.equal(completo[0].percentual, 50);
});

test("mês encerrado usa total vendido dividido pela meta mensal, sem projeções", () => {
  const vendas = [
    lancamento(1, 1, "manha", 2400),
    lancamento(1, 2, "manha", 3600),
    lancamento(1, 1, "noite", 3000),
    lancamento(1, 2, "noite", 3600),
  ];
  const resultado = calcular(vendas, "encerrado", 30, 0);
  assert.equal(resultado[0].referencia, "final");
  assert.equal(resultado[0].percentual, 100);
  assert.ok(Math.abs(resultado[1].percentual - 110) < 1e-9);
});

test("futuro, falta de meta e período sem lançamento mostram ausência de dados", () => {
  assert.equal(calcular([], "futuro", 0)[0].percentual, null);
  assert.equal(calcular([], "andamento", 1)[0].percentual, null);
  assert.equal(calcular([], "andamento", 1, 1020, { metas: [] })[1].referencia, "sem-meta");
  assert.equal(calcular([], "andamento", 0)[0].referencia, "sem-lancamentos");
});


test("a diferença percentual substitui a porcentagem acumulada exibida", () => {
  const acima = classificarDesempenhoPeriodo(127.6, true);
  const abaixo = classificarDesempenhoPeriodo(83.8, true);
  assert.ok(Math.abs(acima.diferenca - 27.6) < 0.00001);
  assert.equal(acima.simbolo, "▲");
  assert.equal(acima.classificacao, "Megameta atingida");
  assert.ok(Math.abs(abaixo.diferenca - 16.2) < 0.00001);
  assert.equal(abaixo.simbolo, "▼");
  assert.equal(abaixo.classificacao, "Meta não atingida");
});

test("classificação identifica níveis de meta e separa parcial de resultado final", () => {
  const faixas = [
    [99.9, null, "Meta não atingida"],
    [100, "Ritmo de Meta", "Meta atingida"],
    [109.9, "Ritmo de Meta", "Meta atingida"],
    [110, "Ritmo de Supermeta", "Supermeta atingida"],
    [119.9, "Ritmo de Supermeta", "Supermeta atingida"],
    [120, "Ritmo de Megameta", "Megameta atingida"],
  ];
  for (const [indice, parcial, final] of faixas) {
    if (parcial !== null) {
      assert.equal(classificarDesempenhoPeriodo(indice, false).classificacao, parcial);
    }
    assert.equal(classificarDesempenhoPeriodo(indice, true).classificacao, final);
  }
  assert.equal(classificarDesempenhoPeriodo(100, true).situacao, "na-meta");
  assert.equal(classificarDesempenhoPeriodo(100, true).simbolo, "");
  assert.equal(classificarDesempenhoPeriodo(null, false), null);
});
