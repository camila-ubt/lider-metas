import assert from "node:assert/strict";
import test from "node:test";
import { planejarProximosSeteDias } from "../src/lib/planejamentoSeteDias.mjs";

const lojas = [{ id: 1, codigo: "AB" }, { id: 2, codigo: "CB" }];
const periodos = ["manha", "noite"];
const historicos = [];
for (let mes = 1; mes <= 6; mes++) {
  const total = new Date(Date.UTC(2026, mes, 0)).getUTCDate();
  for (let dia = 1; dia <= total; dia++) {
    const data = "2026-" + String(mes).padStart(2, "0") +
      "-" + String(dia).padStart(2, "0");
    const fimSemana = [0, 6].includes(new Date(data + "T12:00:00Z").getUTCDay());
    for (const loja of lojas) for (const periodo of periodos) {
      historicos.push({
        data, loja_id: loja.id, periodo,
        valor_vendido: fimSemana ? 200 : 100,
      });
    }
  }
}
function atuais(inicio = 11, fim = 28) {
  const vendas = [];
  for (let dia = inicio; dia <= fim; dia++) {
    const data = "2026-11-" + String(dia).padStart(2, "0");
    for (const loja of lojas) for (const periodo of periodos) {
      vendas.push({ data, loja_id: loja.id, periodo, valor_vendido: 100 });
    }
  }
  return vendas;
}
function metas(mes, valor) {
  return lojas.flatMap((loja) => periodos.map((periodo) => ({
    mes: "2026-" + mes + "-01", loja_id: loja.id, periodo,
    valor_meta: valor,
  })));
}
function calcular(opcoes = {}) {
  return planejarProximosSeteDias({
    hoje: "2026-11-25", lojas, historicos,
    vendasAtuais: atuais(),
    metasAtuais: metas("11", 9000),
    metasProximoMes: metas("12", 9300),
    ...opcoes,
  });
}

test("mostra amanhã e os seis dias seguintes, separados por loja e turno", () => {
  const resultado = calcular();
  assert.equal(resultado.status, "ok");
  assert.equal(resultado.dias.length, 7);
  assert.equal(resultado.dias[0].data, "2026-11-26");
  assert.equal(resultado.dias[6].data, "2026-12-02");
  assert.equal(resultado.totalTurnos, 28);
  assert.equal(resultado.dias[0].linhas.length, 4);
  assert.equal(resultado.dias[0].linhas[0].loja, "AB");
  assert.equal(resultado.dias[0].linhas[1].periodo, "noite");
  assert.ok(resultado.dias[0].linhas[0].previsto > 0);
});

test("usa meta fixa do mês correto, inclusive quando vira o mês", () => {
  const resultado = calcular();
  assert.equal(resultado.dias[0].linhas[0].meta, 300); // 9000 / 30.
  assert.equal(resultado.dias[5].linhas[0].meta, 300); // 9300 / 31.
  const diferente = calcular({
    metasProximoMes: metas("12", 15500),
  });
  assert.equal(diferente.dias[5].linhas[0].meta, 500);
  assert.equal(diferente.dias[0].linhas[0].meta, 300);
});

test("nunca reaproveita meta do mês anterior quando o mês futuro não foi configurado", () => {
  const resultado = calcular({ metasProximoMes: [] });
  assert.equal(resultado.dias[5].linhas[0].meta, null);
  assert.equal(resultado.dias[5].linhas[0].situacao, "sem_meta");
  assert.equal(resultado.dias[5].linhas[0].falta, null);
  assert.equal(resultado.dias[0].linhas[0].meta, 300);
});

test("destaca o risco real como diferença entre previsão e meta", () => {
  const resultado = calcular();
  const alerta = resultado.alertas[0];
  assert.ok(alerta.falta > 0);
  assert.ok(alerta.previsto < alerta.meta);
  assert.equal(alerta.falta, Math.round((alerta.meta - alerta.previsto) * 100) / 100);
  assert.ok(alerta.percentualAbaixo > 0);
});

test("não usa venda de hoje ou de amanhã como se estivesse encerrada", () => {
  const base = calcular();
  const fraude = calcular({ vendasAtuais: [
    ...atuais(),
    { data: "2026-11-25", loja_id: 1, periodo: "manha", valor_vendido: 500000 },
    { data: "2026-11-26", loja_id: 1, periodo: "manha", valor_vendido: 500000 },
  ] });
  assert.equal(base.dias[0].linhas[0].previsto, fraude.dias[0].linhas[0].previsto);
});

test("último dia sem lançamento bloqueia estimativa sem tratá-lo como zero", () => {
  const r = calcular({
    vendasAtuais: atuais().filter((item) => item.data !== "2026-11-24"),
  });
  assert.equal(r.dias[0].linhas[0].previsto, null);
  assert.equal(r.dias[0].linhas[0].situacao, "sem_previsao");
  assert.equal(r.alertas.length, 0);
  assert.equal(r.semPrevisao, 28);
});

test("duplicação do último dia bloqueia estimativa, zero explícito é válido", () => {
  const registros = atuais();
  const duplicado = calcular({
    vendasAtuais: [...registros, registros.find((item) =>
      item.loja_id === 1 && item.periodo === "manha" &&
      item.data === "2026-11-24")],
  });
  assert.equal(duplicado.dias[0].linhas[0].situacao, "sem_previsao");
  const zero = calcular({
    vendasAtuais: registros.map((item) =>
      item.data === "2026-11-24" ? { ...item, valor_vendido: 0 } : item),
  });
  assert.ok(zero.dias[0].linhas[0].previsto !== null);
});

test("sem quatro meses completos de treino não promete previsão", () => {
  const resultado = calcular({ historicos: historicos.filter((item) =>
    item.data.startsWith("2026-01") || item.data.startsWith("2026-02")) });
  assert.equal(resultado.dias[0].linhas[0].situacao, "sem_previsao");
  assert.equal(resultado.alertas.length, 0);
});

test("os fatores do dia da semana alteram o valor diário previsto", () => {
  const r = calcular();
  const porData = (dia) => r.dias.find((item) => item.data === dia).linhas[0].previsto;
  assert.ok(porData("2026-11-28") > porData("2026-11-27"));
});

test("previsões não se misturam entre lojas e turnos", () => {
  const r = calcular({ vendasAtuais: atuais().map((item) =>
    item.loja_id === 2 && item.periodo === "noite"
      ? { ...item, valor_vendido: 800 } : item) });
  assert.ok(r.dias[0].linhas.find((item) =>
    item.lojaId === 2 && item.periodo === "noite").previsto >
    r.dias[0].linhas.find((item) =>
      item.lojaId === 1 && item.periodo === "manha").previsto);
});

test("referência inválida é recusada e não cria alertas", () => {
  const r = calcular({ hoje: "2026-11-31" });
  assert.equal(r.status, "parametros_invalidos");
  assert.equal(r.alertas.length, 0);
});
