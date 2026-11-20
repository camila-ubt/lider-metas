import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularMetricasPrevisao,
  validarProjecoesHistoricas,
} from "../src/lib/validacaoProjecoes.mjs";

const lojas = [{ id: 1 }];

function gerarMes(gerarValor, totalDias = 30) {
  return Array.from({ length: totalDias }, (_, indice) => ({
    data: "2026-11-" + String(indice + 1).padStart(2, "0"),
    loja_id: 1, periodo: "manha",
    valor_vendido: gerarValor(indice + 1),
  }));
}

const validar = (vendas, opcoes = {}) => validarProjecoesHistoricas({
  vendas, lojas, ano: 2026, numeroMes: 11, periodo: "manha", ...opcoes,
});

function perto(valor, esperado) {
  assert.ok(Math.abs(valor - esperado) < 1e-8, String(valor) + " != " + String(esperado));
}

test("calcula MAE, RMSE, MAPE, WAPE e viés com resultado conhecido", () => {
  const r = calcularMetricasPrevisao([
    { previsto: 90, realizado: 100 },
    { previsto: 120, realizado: 100 },
  ]);
  assert.equal(r.amostras, 2);
  assert.equal(r.amostrasMape, 2);
  assert.equal(r.mae, 15);
  perto(r.rmse, Math.sqrt(250));
  perto(r.mape, 15);
  perto(r.wape, 15);
  perto(r.vies, 5);
});

test("venda real igual a zero não causa divisão por zero no MAPE", () => {
  const r = calcularMetricasPrevisao([
    { previsto: 20, realizado: 0 },
    { previsto: 80, realizado: 100 },
  ]);
  assert.equal(r.amostras, 2);
  assert.equal(r.amostrasMape, 1);
  assert.equal(r.mae, 20);
  assert.equal(r.mape, 20);
  assert.equal(r.wape, 40);
});

test("sem observações válidas não inventa acurácia", () => {
  const r = calcularMetricasPrevisao([{ previsto: null, realizado: 100 }]);
  assert.equal(r.amostras, 0);
  assert.equal(r.mape, null);
  assert.equal(r.wape, null);
  assert.equal(r.mae, null);
});

test("mês constante produz previsões sem erro em todos os dias de corte", () => {
  const r = validar(gerarMes(() => 100));
  assert.equal(r.status, "ok");
  assert.equal(r.totalRealizado, 3000);
  assert.deepEqual(r.previsoes.map((p) => p.diaCorte), [5, 10, 15, 20, 25]);
  assert.deepEqual(r.previsoes.map((p) => p.previsto), [3000, 3000, 3000, 3000, 3000]);
  assert.equal(r.metricas.mape, 0);
  assert.equal(r.metricas.mae, 0);
});

test("identifica que ritmo constante subestima mês que acelera na segunda metade", () => {
  const r = validar(gerarMes((dia) => dia <= 15 ? 100 : 200));
  assert.equal(r.status, "ok");
  assert.equal(r.totalRealizado, 4500);
  assert.equal(r.previsoes[0].previsto, 3000);
  assert.equal(r.previsoes[3].previsto, 3750);
  assert.equal(r.previsoes[4].previsto, 4200);
  assert.ok(r.metricas.vies < 0);
  assert.ok(r.metricas.mape > 0);
});

test("não usa vendas futuras para montar previsão do dia 5", () => {
  const base = validar(gerarMes((dia) => dia <= 5 ? 100 : 200), { diasCorte: [5] });
  const outra = validar(gerarMes((dia) => dia <= 5 ? 100 : 500), { diasCorte: [5] });
  assert.equal(base.previsoes[0].previsto, 3000);
  assert.equal(outra.previsoes[0].previsto, 3000);
  assert.notEqual(base.totalRealizado, outra.totalRealizado);
});

test("dia não lançado é ausente, não é confundido com venda zero", () => {
  const faltando = gerarMes(() => 100).filter((v) => !v.data.endsWith("-08"));
  const r = validar(faltando);
  assert.equal(r.status, "base_incompleta");
  assert.equal(r.faltantes, 1);
  assert.equal(r.previsoes.length, 0);
});

test("lançamento zero é dado legítimo, mas duplicidade bloqueia avaliação", () => {
  const zero = validar(gerarMes((dia) => dia === 8 ? 0 : 100));
  assert.equal(zero.status, "ok");
  const duplicado = gerarMes(() => 100);
  duplicado.push({ ...duplicado[0] });
  const r = validar(duplicado);
  assert.equal(r.status, "base_incompleta");
  assert.equal(r.duplicados, 1);
});

test("período todos compara somente quando manhã e noite têm dados completos", () => {
  const somenteManha = gerarMes(() => 100);
  const r = validar(somenteManha, { periodo: "todos" });
  assert.equal(r.status, "base_incompleta");
  assert.equal(r.faltantes, 30);
  const ambas = [
    ...somenteManha,
    ...somenteManha.map((item) => ({ ...item, periodo: "noite", valor_vendido: 200 })),
  ];
  const ok = validar(ambas, { periodo: "todos" });
  assert.equal(ok.status, "ok");
  assert.equal(ok.totalRealizado, 9000);
  assert.equal(ok.metricas.mape, 0);
});
