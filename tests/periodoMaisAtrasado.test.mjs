import assert from "node:assert/strict";
import test from "node:test";
import { encontrarPeriodoMaisAtrasado } from "../src/lib/periodoMaisAtrasado.mjs";

const lojas = [
  { id: 1, nome: "Clube" },
  { id: 2, nome: "Arte" },
  { id: 3, nome: "Adoro" },
];
const periodos = ["manha", "noite"];
const metas = lojas.flatMap((loja) => periodos.map((periodo) => ({
  loja_id: loja.id,
  periodo,
  valor_meta: loja.id === 2 && periodo === "noite" ? 30000 : 3000,
})));
const contexto = (tipo = "andamento", diaCorte = 1) => ({
  ano: 2026, numeroMes: 10, ultimoDia: 30, diaCorte, tipo,
});
const diaData = (dia) => "2026-10-" + String(dia).padStart(2, "0");
const lancamentos = (dia, ajuste = () => null) => lojas.flatMap((loja) =>
  periodos.map((periodo) => ({
    data: diaData(dia), loja_id: loja.id, periodo,
    valor_vendido: ajuste(loja.id, periodo) ??
      (loja.id === 2 && periodo === "noite" ? 1000 : 100),
  })),
);
const calcular = (vendas, opcoes = {}) => encontrarPeriodoMaisAtrasado({
  lojas, metas, vendas, contexto: contexto(), minutosAgora: 1400, ...opcoes,
});

test("um único destaque identifica o maior atraso percentual, não o maior déficit em reais", () => {
  const vendas = lancamentos(1, (loja, periodo) => {
    if (loja === 3 && periodo === "manha") return 30;
    if (loja === 2 && periodo === "noite") return 600;
    return null;
  });
  const resultado = calcular(vendas);
  assert.equal(resultado.status, "atrasado");
  assert.equal(resultado.loja.nome, "Adoro");
  assert.equal(resultado.periodo, "manha");
  assert.equal(resultado.atrasoPercentual, 70);
  assert.equal(resultado.atraso, 70);
  assert.equal(resultado.diasAnalisados, 1);
  assert.equal(resultado.projecao, 900);
  assert.equal(resultado.percentualProjetado, 30);
  assert.equal(resultado.faltaProjetada, 2100);
});

test("após as 16h a manhã de hoje entra, mas a noite aguarda seu encerramento", () => {
  const primeiroDia = lancamentos(1);
  const segundoDia = lancamentos(2, (loja, periodo) =>
    loja === 3 && periodo === "manha" ? 0 : null,
  );
  const resultado = calcular([...primeiroDia, ...segundoDia], {
    contexto: contexto("andamento", 2),
    minutosAgora: 17 * 60,
  });
  assert.equal(resultado.status, "atrasado");
  assert.equal(resultado.loja.nome, "Adoro");
  assert.equal(resultado.periodo, "manha");
  assert.equal(resultado.dia, 2);
  assert.equal(resultado.diasAnalisados, 2);
  assert.equal(resultado.atrasoPercentual, 50);
});

test("às 16h exatas o turno da manhã já é elegível", () => {
  const resultado = calcular(lancamentos(1, (loja, periodo) =>
    loja === 3 && periodo === "manha" ? 0 : null,
  ), { minutosAgora: 960 });
  assert.equal(resultado.loja.nome, "Adoro");
});

test("antes das 16h, o lançamento antecipado da manhã não entra", () => {
  const resultado = calcular(lancamentos(1, (loja, periodo) =>
    loja === 3 && periodo === "manha" ? 0 : null,
  ), { minutosAgora: 959 });
  assert.equal(resultado.status, "sem-lancamentos");
});

test("lançamento ausente não vira venda zero; lançamento explícito zero entra", () => {
  const primeiroDia = lancamentos(1);
  const diaDoisIncompleto = lancamentos(2, (loja, periodo) =>
    loja === 3 && periodo === "manha" ? 0 : null,
  ).filter((item) => !(item.loja_id === 1 && item.periodo === "manha"));
  const resultado = calcular([...primeiroDia, ...diaDoisIncompleto], {
    contexto: contexto("andamento", 2),
  });
  assert.equal(resultado.status, "em-dia");
  const completo = calcular([...primeiroDia, ...lancamentos(2, (loja, periodo) =>
    loja === 3 && periodo === "manha" ? 0 : null,
  )], { contexto: contexto("andamento", 2) });
  assert.equal(completo.status, "atrasado");
  assert.equal(completo.loja.nome, "Adoro");
});

test("mês encerrado compara todos os períodos, inclusive à noite", () => {
  const resultado = calcular(lancamentos(1, (loja, periodo) =>
    loja === 2 && periodo === "noite" ? 100 : null,
  ), { contexto: contexto("encerrado", 30), minutosAgora: 0 });
  assert.equal(resultado.periodo, "noite");
  assert.equal(resultado.loja.nome, "Arte");
});

test("sem metas completas ou no futuro, não inventa último colocado", () => {
  assert.equal(calcular(lancamentos(1), { metas: metas.slice(1) }).status, "sem-metas");
  assert.equal(calcular(lancamentos(1), { contexto: contexto("futuro", 0) }).status, "sem-dados");
});

test("quando todas as lojas estão em dia, não sinaliza atraso", () => {
  assert.equal(calcular(lancamentos(1)).status, "em-dia");
});


test("projeção usa a média dos dias encerrados e a meta mensal inteira", () => {
  const resultado = calcular([
    ...lancamentos(1, (loja, periodo) => loja === 3 && periodo === "manha" ? 20 : null),
    ...lancamentos(2, (loja, periodo) => loja === 3 && periodo === "manha" ? 40 : null),
  ], { contexto: contexto("andamento", 2) });
  assert.equal(resultado.loja.nome, "Adoro");
  assert.equal(resultado.diasAnalisados, 2);
  assert.equal(resultado.vendido, 60);
  assert.equal(resultado.projecao, 900);
  assert.equal(resultado.percentualProjetado, 30);
  assert.equal(resultado.faltaProjetada, 2100);
});

test("projeção considera somente o ciclo encerrado e evita antecipar o resultado da noite", () => {
  const dia1 = lancamentos(1);
  const dia2 = lancamentos(2, (loja, periodo) => loja === 3 && periodo === "manha" ? 50 : null);
  const resultado = calcular([...dia1, ...dia2], {
    contexto: contexto("andamento", 2), minutosAgora: 17 * 60,
  });
  assert.equal(resultado.periodo, "manha");
  assert.equal(resultado.diasAnalisados, 2);
  assert.equal(resultado.projecao, 2250);
  assert.equal(resultado.percentualProjetado, 75);
  assert.equal(resultado.faltaProjetada, 750);
});
