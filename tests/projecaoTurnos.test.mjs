import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularProjecaoTurno,
  calcularMetasTurno,
  calcularTurnosRestantes,
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
  const resultado = projetar(vendas, "manha", contexto("andamento", 1), 800, 720);
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

test("lançamento parcial de hoje não entra na média antes do fechamento", () => {
  const vendas = [
    venda(1, 1, "noite", 100),
    venda(1, 2, "noite", 200),
    venda(2, 1, "noite", 50),
  ];
  const resultado = projetar(vendas, "noite", contexto("andamento", 2), 900, 1320);
  assert.equal(resultado.diasBase, 1);
  assert.equal(resultado.media, 300);
  assert.equal(resultado.valor, 9000);
  const lojaUm = projetar(vendas, "noite", contexto("andamento", 2), 900, 1320, 1);
  const lojaDois = projetar(vendas, "noite", contexto("andamento", 2), 900, 1320, 2);
  assert.equal(somarProjecoes(lojaUm.valor, lojaDois.valor), resultado.valor);
});

test("loja sem histórico não recebe projeção artificial, mas o total com base é preservado", () => {
  const vendas = [venda(1, 1, "manha", 250)];
  const periodo = contexto("andamento", 1);
  const geral = projetar(vendas, "manha", periodo, 800, 720).valor;
  const uma = projetar(vendas, "manha", periodo, 800, 720, 1).valor;
  const duas = projetar(vendas, "manha", periodo, 800, 720, 2).valor;
  assert.equal(duas, null);
  assert.equal(geral, uma);
});

test("antes e depois das 16h usa o fechamento configurado, não o lançamento", () => {
  const selecionado = contexto("andamento", 15, 31);
  const manha = { contexto: selecionado, fimTurno: 16 * 60 };
  const noite = { contexto: selecionado, fimTurno: 22 * 60 };
  assert.equal(calcularTurnosRestantes({ ...manha, minutosAgora: 959 }), 17);
  assert.equal(calcularTurnosRestantes({ ...manha, minutosAgora: 960 }), 16);
  assert.equal(calcularTurnosRestantes({ ...noite, minutosAgora: 960 }), 17);
  assert.equal(calcularTurnosRestantes({ ...noite, minutosAgora: 1320 }), 16);
});

test("turno ainda não lançado mantém média anterior e muda apenas os turnos restantes", () => {
  const vendas = [
    venda(1, 1, "manha", 120),
    venda(1, 2, "manha", 180),
  ];
  const mes = contexto("andamento", 2);
  const antes = projetar(vendas, "manha", mes, 959, 960);
  const depois = projetar(vendas, "manha", mes, 960, 960);
  assert.equal(antes.diasBase, 1);
  assert.equal(antes.media, 300);
  assert.equal(depois.diasBase, 1);
  assert.equal(depois.media, 300);
  assert.equal(antes.valor, 9000);
  assert.equal(depois.valor, 8700);
});

test("um lançamento no dia faz entrar apenas os dias efetivamente lançados na média", () => {
  const vendas = [
    venda(1, 1, "noite", 100),
    venda(1, 2, "noite", 200),
    venda(3, 1, "noite", 200),
    venda(3, 2, "noite", 400),
  ];
  const calculado = projetar(vendas, "noite", contexto("andamento", 4), 1020, 1320);
  assert.equal(calculado.diasBase, 2);
  assert.equal(calculado.media, 450);
  assert.equal(calculado.valor, 13050);
});

test("o lançamento de uma loja não reduz artificialmente a média das outras", () => {
  const vendas = [
    venda(1, 1, "noite", 100),
    venda(1, 2, "noite", 200),
    venda(2, 1, "noite", 50),
  ];
  const hoje = contexto("andamento", 2);
  const total = projetar(vendas, "noite", hoje, 960, 1320);
  const primeira = projetar(vendas, "noite", hoje, 960, 1320, 1);
  const segunda = projetar(vendas, "noite", hoje, 960, 1320, 2);
  assert.equal(total.media, 300);
  assert.equal(primeira.media, 100);
  assert.equal(segunda.media, 200);
  assert.equal(somarProjecoes(primeira.valor, segunda.valor), total.valor);
});

test("dia com lançamento de zero é considerado na média", () => {
  const vendas = [
    venda(1, 1, "manha", 100),
    venda(2, 1, "manha", 0),
  ];
  const resultado = calcularProjecaoTurno({
    vendas, lojas: [{ id: 1 }], periodo: "manha",
    contexto: contexto("andamento", 2), minutosAgora: 1020, fimTurno: 960,
  });
  assert.equal(resultado.diasBase, 2);
  assert.equal(resultado.media, 50);
  assert.equal(resultado.valor, 1500);
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
  assert.equal(faixas[0].porLojaTurno, 4800 / 11 / lojas.length);
  assert.ok(faixas[0].variacao > 45 && faixas[0].variacao < 46);
  assert.equal(faixas[1].fixa, 330);
  assert.equal(faixas[2].fixa, 360);
  assert.equal(faixas[2].ajustada, 6660 / 11);
  assert.equal(faixas[1].porLojaTurno, (9300 * 1.1 - 4500) / 11 / 2);
  assert.equal(faixas[2].porLojaTurno, 6660 / 11 / 2);
});

test("sem turnos restantes, não divide o saldo por zero", () => {
  const valores = calcularMetasTurno({
    metas: [{ loja_id: 1, periodo: "manha", valor_meta: 3000 }],
    lojas: [{ id: 1 }], periodo: "manha", vendido: 300,
    diasMes: 30, turnosRestantes: 0,
  });
  assert.equal(valores[0].ajustada, null);
  assert.equal(valores[0].porLojaTurno, null);
  assert.equal(valores[0].variacao, null);
});

test("metas sem lojas não tentam dividir por zero", () => {
  const niveis = calcularMetasTurno({
    metas: [], lojas: [], periodo: "manha", vendido: 0,
    diasMes: 31, turnosRestantes: 12,
  });
  assert.equal(niveis.length, 3);
  niveis.forEach((nivel) => assert.equal(nivel.porLojaTurno, null));
});

test("parcial sem histórico fechado não produz projeção artificial", () => {
  const vendas = [venda(1, 1, "noite", 50)];
  const resultado = projetar(vendas, "noite", contexto("andamento", 1), 1000, 1320);
  assert.equal(resultado.diasBase, 0);
  assert.equal(resultado.valor, null);
  assert.equal(resultado.media, null);
});

test("o parcial de hoje compõe o realizado sem contar um turno inteiro duas vezes", () => {
  const vendas = [
    venda(1, 1, "noite", 100),
    venda(1, 2, "noite", 200),
    venda(2, 1, "noite", 20),
    venda(2, 2, "noite", 30),
  ];
  const antes = projetar(vendas, "noite", contexto("andamento", 2), 1000, 1320);
  assert.equal(antes.media, 300);
  assert.equal(antes.valor, 9000);
  const completo = projetar(vendas, "noite", contexto("andamento", 2), 1320, 1320);
  assert.equal(completo.diasBase, 2);
  assert.equal(completo.valor, 5250);
});

test("a meta mensal da manhã e noite avança de nível sem depender dos turnos restantes", async () => {
  const { proximoNivel } = await import("../src/lib/contextoMes.js");
  const metaManha = 48000;
  const metaNoite = 71500;
  assert.deepEqual(proximoNivel(47000, metaManha), { nome: "Meta", valor: 48000 });
  assert.deepEqual(proximoNivel(53221.28, metaManha), { nome: "Megameta", valor: 57600 });
  assert.equal(proximoNivel(57600, metaManha), null);
  assert.deepEqual(proximoNivel(79600.76, metaNoite), { nome: "Megameta", valor: 85800 });
  assert.deepEqual(proximoNivel(71500, metaNoite), { nome: "Supermeta", valor: 78650 });
  assert.equal(proximoNivel(0, 0), null);
});

test("a régua usa a proporção matemática até a Megameta mensal", async () => {
  const { calcularProgressoMegameta } = await import("../src/lib/contextoMes.js");
  const progresso = (valor) => calcularProgressoMegameta(valor, 1000);
  const conferir = (valor, esperado) =>
    assert.ok(Math.abs(progresso(valor).percentualBarra - esperado) < 1e-9);

  conferir(0, 0);
  conferir(500, (500 / 1200) * 100);
  conferir(1000, (1000 / 1200) * 100);
  conferir(1050, 87.5);
  conferir(1100, (1100 / 1200) * 100);
  conferir(1150, (1150 / 1200) * 100);
  conferir(1200, 100);

  assert.equal(progresso(600).alvo, 1200);
  assert.equal(progresso(600).percentual, 50);
  assert.equal(progresso(600).percentualBarra, 50);
  assert.equal(progresso(600).falta, 600);
  assert.equal(progresso(1100).falta, 100);
  assert.equal(progresso(1200).falta, 0);
});

test("acima da Megameta a barra não ultrapassa o limite mas conserva o excedente", async () => {
  const { calcularProgressoMegameta } = await import("../src/lib/contextoMes.js");
  const resultado = calcularProgressoMegameta(1320, 1000);
  assert.ok(Math.abs(resultado.percentual - 110) < 1e-9);
  assert.equal(resultado.percentualBarra, 100);
  assert.equal(resultado.excedente, 120);
  assert.equal(resultado.falta, 0);
  assert.equal(calcularProgressoMegameta(0, 0), null);
  assert.equal(calcularProgressoMegameta(100, -1), null);
  assert.equal(calcularProgressoMegameta(100, NaN), null);
});
