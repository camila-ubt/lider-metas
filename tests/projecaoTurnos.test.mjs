import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularProjecaoTurno,
  calcularMetasTurno,
  somarProjecoes,
} from "../src/lib/projecaoTurnos.mjs";

const lojas = [{ id: 1 }, { id: 2 }];
const contexto = (tipo, diaCorte, ultimoDia = 30) => ({
  tipo,
  ano: 2026,
  numeroMes: 10,
  diaCorte,
  ultimoDia,
});
const venda = (dia, lojaId, periodo, valor_vendido) => ({
  data: `2026-10-${String(dia).padStart(2, "0")}`,
  loja_id: lojaId,
  periodo,
  valor_vendido,
});
const projetar = (vendas, periodo, contextoAtual, minutosAgora, fimTurno, lojaId = null) =>
  calcularProjecaoTurno({
    vendas, lojas, periodo, lojaId, contexto: contextoAtual, minutosAgora, fimTurno,
  });

test("projeção inicia no primeiro dia com vendas lançadas", () => {
  const vendas = [venda(1, 1, "manha", 100), venda(1, 2, "manha", 200)];
  const resultado = projetar(vendas, "manha", contexto("andamento", 1), 600, 720);
  assert.equal(resultado.media, 300);
  assert.equal(resultado.valor, 9000);
  assert.equal(resultado.diasBase, 1);
});

test("turno não lançado hoje mantém média dos dias anteriores", () => {
  const vendas = [venda(1, 1, "noite", 100), venda(1, 2, "noite", 200)];
  const resultado = projetar(vendas, "noite", contexto("andamento", 2), 900, 1320);
  assert.equal(resultado.media, 300);
  assert.equal(resultado.valor, 9000);
  assert.equal(resultado.diasBase, 1);
});

test("lançamento do turno de hoje atualiza a média e projeção imediatamente", () => {
  const vendas = [
    venda(1, 1, "noite", 100),
    venda(1, 2, "noite", 200),
    venda(2, 1, "noite", 50),
  ];
  const resultado = projetar(vendas, "noite", contexto("andamento", 2), 900, 1320);
  assert.equal(resultado.diasBase, 2);
  assert.equal(resultado.media, 175);
  assert.equal(resultado.valor, 5250);
  const lojaUm = projetar(vendas, "noite", contexto("andamento", 2), 900, 1320, 1);
  const lojaDois = projetar(vendas, "noite", contexto("andamento", 2), 900, 1320, 2);
  assert.equal(somarProjecoes(lojaUm.valor, lojaDois.valor), resultado.valor);
});

test("projeção geral soma as lojas mesmo quando uma ainda não tem lançamento", () => {
  const vendas = [venda(1, 1, "manha", 250)];
  const periodo = contexto("andamento", 1);
  const geral = projetar(vendas, "manha", periodo, 650, 720).valor;
  const uma = projetar(vendas, "manha", periodo, 650, 720, 1).valor;
  const duas = projetar(vendas, "manha", periodo, 650, 720, 2).valor;
  assert.equal(duas, 0);
  assert.equal(geral, uma + duas);
});

test("meses encerrados usam o resultado realizado, futuros não projetam", () => {
  const vendas = [venda(1, 1, "manha", 100)];
  assert.equal(projetar(vendas, "manha", contexto("encerrado", 30), 800, 720).valor, 100);
  assert.equal(projetar(vendas, "manha", contexto("futuro", 0), 800, 720).valor, null);
});

test("metas por turno comparam necessário com a meta fixa das lojas", () => {
  const metas = [
    { loja_id: 1, periodo: "noite", valor_meta: 3100 },
    { loja_id: 2, periodo: "noite", valor_meta: 6200 },
  ];
  const faixas = calcularMetasTurno({
    metas, lojas, periodo: "noite", vendido: 4500,
    diasMes: 31, turnosRestantes: 11,
  });
  assert.equal(faixas[0].fixa, 300);
  assert.equal(faixas[0].ajustada, 4800 / 11);
  assert.ok(faixas[0].variacao > 45 && faixas[0].variacao < 46);
  assert.equal(faixas[1].fixa, 330);
  assert.equal(faixas[2].fixa, 360);
  assert.equal(faixas[2].ajustada, 6660 / 11);
});

test("sem turnos restantes, não divide o saldo por zero", () => {
  const valores = calcularMetasTurno({
    metas: [{ loja_id: 1, periodo: "manha", valor_meta: 3000 }],
    lojas: [{ id: 1 }], periodo: "manha", vendido: 300,
    diasMes: 30, turnosRestantes: 0,
  });
  assert.equal(valores[0].ajustada, null);
  assert.equal(valores[0].variacao, null);
});
