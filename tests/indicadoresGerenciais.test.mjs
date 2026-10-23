import assert from "node:assert/strict";
import test from "node:test";

import { analisarIndicadoresGerenciais } from "../src/lib/indicadoresGerenciais.mjs";
import { calcularProjecaoTurno } from "../src/lib/projecaoTurnos.mjs";

const lojas = [{ id: 1 }, { id: 2 }];
const metas = [
  { loja_id: 1, periodo: "manha", valor_meta: 1000 },
  { loja_id: 1, periodo: "noite", valor_meta: 2000 },
  { loja_id: 2, periodo: "manha", valor_meta: 1000 },
  { loja_id: 2, periodo: "noite", valor_meta: 2000 },
];
const contexto = {
  tipo: "andamento", ano: 2026, numeroMes: 10, diaCorte: 4, ultimoDia: 31,
};
const venda = (dia, loja_id, periodo, valor_vendido) => ({
  data: "2026-10-" + String(dia).padStart(2, "0"),
  loja_id, periodo, valor_vendido,
});
const vendas = [
  venda(1, 1, "manha", 100), venda(1, 2, "manha", 200),
  venda(1, 1, "noite", 300), venda(1, 2, "noite", 400),
  venda(2, 1, "manha", 120), venda(2, 2, "manha", 180),
  venda(2, 1, "noite", 350), venda(2, 2, "noite", 450),
  venda(3, 1, "manha", 110), venda(3, 2, "manha", 190),
  venda(3, 1, "noite", 320), venda(3, 2, "noite", 430),
  venda(4, 1, "manha", 10), venda(4, 2, "manha", 20),
  venda(4, 1, "noite", 5), venda(4, 2, "noite", 0),
];
const analisar = (extras = {}) => analisarIndicadoresGerenciais({
  vendas, lojas, metas, contexto,
  minutosAgora: 1000, fimManha: 960, fimNoite: 1320, ...extras,
});

test("dia de hoje não é completo enquanto a noite estiver aberta, mesmo com lançamentos", () => {
  const dados = analisar();
  assert.equal(dados.diasObservados.length, 4);
  assert.equal(dados.diasCompletos.length, 3);
  assert.deepEqual(dados.ultimosValores, [1000, 1100, 1050]);
  assert.equal(dados.tendencia.inclinacao, 25);
  assert.equal(dados.totalVendido, 3185);
});

test("centro e chances estatísticas seguem a projeção por turnos do painel", () => {
  const dados = analisar();
  const previstos = ["manha", "noite"].map((periodo) =>
    calcularProjecaoTurno({
      vendas, lojas, periodo, contexto, minutosAgora: 1000,
      fimTurno: periodo === "manha" ? 960 : 1320,
    }).valor,
  );
  assert.equal(dados.projecaoOperacional, previstos[0] + previstos[1]);
  assert.equal(dados.faixa.centro, dados.projecaoOperacional);
  assert.ok(dados.probabilidades.meta >= dados.probabilidades.super);
  assert.ok(dados.probabilidades.super >= dados.probabilidades.mega);
});

test("filtros restringem vendas, metas, amostra e projeções ao mesmo escopo", () => {
  const dados = analisar({ filtroLoja: "1", filtroPeriodo: "noite" });
  assert.equal(dados.totalMeta, 2000);
  assert.equal(dados.totalVendido, 975);
  assert.equal(dados.diasCompletos.length, 3);
  assert.deepEqual(dados.ultimosValores, [300, 350, 320]);
  const previsao = calcularProjecaoTurno({
    vendas, lojas: [{ id: 1 }], periodo: "noite",
    contexto, minutosAgora: 1000, fimTurno: 1320,
  });
  assert.equal(dados.projecaoOperacional, previsao.valor);
});

test("turno da manhã fechado pode compor a base mesmo com a noite aberta", () => {
  const dados = analisar({ filtroPeriodo: "manha" });
  assert.equal(dados.diasCompletos.length, 4);
  assert.equal(dados.totalMeta, 2000);
  assert.equal(dados.probabilidades.meta !== null, true);
});

test("sem três dias completos não são mostradas probabilidades artificiais", () => {
  const registros = vendas.filter((v) =>
    v.data !== "2026-10-02" || v.periodo !== "noite" || v.loja_id !== 2,
  ).filter((v) => v.data !== "2026-10-03");
  const dados = analisar({ vendas: registros });
  assert.equal(dados.diasCompletos.length, 1);
  assert.equal(dados.faixa, null);
  assert.equal(dados.probabilidades.meta, null);
  assert.equal(dados.probabilidades.mega, null);
});

test("após encerrar a noite, o dia inteiro pode entrar na base", () => {
  const dados = analisar({ minutosAgora: 1320 });
  assert.equal(dados.diasCompletos.length, 4);
});
