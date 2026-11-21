import assert from "node:assert/strict";
import test from "node:test";
import { avaliarCalibracaoProbabilidades } from "../src/lib/calibracaoProbabilidades.mjs";

const lojas = [{ id: 1 }];
const prefixo = (ano, mes) => String(ano) + "-" + String(mes).padStart(2, "0");
function gerar(ano, mes) {
  const chave = prefixo(ano, mes);
  const quantidade = new Date(ano, mes, 0).getDate();
  return {
    meta: { mes: chave + "-01", loja_id: 1, periodo: "manha", valor_meta: 3000 },
    vendas: Array.from({ length: quantidade }, (_, i) => ({
      data: chave + "-" + String(i + 1).padStart(2, "0"),
      loja_id: 1, periodo: "manha",
      valor_vendido: (i + 1) <= 15 ? 90 : (mes % 2 ? 115 : 130),
    })),
  };
}
const historicos = [2024, 2025, 2026].flatMap((ano) =>
  Array.from({ length: ano === 2024 ? 6 : ano === 2026 ? 10 : 12 }, (_, i) =>
    gerar(ano, ano === 2024 ? i + 7 : i + 1)));
const dados = {
  lojas, ano: 2026, numeroMes: 11, diaLimite: 20,
  filtroLoja: "1", filtroPeriodo: "manha",
  probabilidades: { meta: 70, super: 50, mega: 30 },
  metasHistoricas: historicos.map((mes) => mes.meta),
  vendasHistoricas: historicos.flatMap((mes) => mes.vendas),
};

test("constrói amostras por mês sem antecipar referência do próprio ano", () => {
  const r = avaliarCalibracaoProbabilidades(dados);
  assert.ok(r.totalMeses > 0);
  assert.equal(new Set(r.observacoes.map((o) => o.mes)).size, r.totalMeses);
  assert.ok(r.observacoes.every((o) => o.mes < "2026-11"));
  assert.ok(r.observacoes.every((o) => ["meta", "super", "mega"].includes(o.nivel)));
  assert.ok(r.niveis.meta.brier >= 0 && r.niveis.meta.brier <= 1);
});

test("não ajusta porcentagem com amostra insuficiente", () => {
  const r = avaliarCalibracaoProbabilidades({ ...dados, minimoVizinhos: 100 });
  assert.deepEqual(r.probabilidades, dados.probabilidades);
  assert.equal(r.status, "amostra_insuficiente");
});

test("probabilidades calibradas preservam a ordem dos níveis", () => {
  const r = avaliarCalibracaoProbabilidades({ ...dados, minimoVizinhos: 1 });
  assert.ok(r.probabilidades.meta >= r.probabilidades.super);
  assert.ok(r.probabilidades.super >= r.probabilidades.mega);
  assert.equal(r.probabilidades.meta % 5, 0);
});

test("não altera previsão se faltam histórico ou dados do nível", () => {
  const r = avaliarCalibracaoProbabilidades({
    ...dados, vendasHistoricas: [], metasHistoricas: [],
  });
  assert.equal(r.totalMeses, 0);
  assert.deepEqual(r.probabilidades, dados.probabilidades);
});
