import assert from "node:assert/strict";
import test from "node:test";
import {
  ehFeriadoNacional, preverFechamentoCalendario,
} from "../src/lib/previsaoCalendario.mjs";
import { compararPrevisoesCalendario } from "../src/lib/validacaoCalendario.mjs";

function gerarMes(ano, mes, valor, loja = 1, periodo = "manha") {
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return Array.from({ length: dias }, (_, indice) => {
    const dia = indice + 1;
    const data = String(ano) + "-" + String(mes).padStart(2, "0") +
      "-" + String(dia).padStart(2, "0");
    return { data, loja_id: loja, periodo, valor_vendido: valor(data, dia) };
  });
}
function perfil(data) {
  return [0, 6].includes(new Date(data + "T12:00:00Z").getUTCDay()) ? 240 : 100;
}
const historicos = [];
for (let mes = 7; mes <= 12; mes += 1) historicos.push(...gerarMes(2024, mes, perfil));
for (let mes = 1; mes <= 6; mes += 1) historicos.push(...gerarMes(2025, mes, perfil));
const julho = gerarMes(2025, 7, perfil);
const prever = (vendas, extra = {}) => preverFechamentoCalendario({
  vendas, historicos, ano: 2025, numeroMes: 7,
  diaCorte: 10, lojaId: 1, periodo: "manha", ...extra,
});

test("identifica feriados fixos e Sexta-feira Santa sem deslocamento de fuso", () => {
  assert.equal(ehFeriadoNacional("2026-04-03"), true);
  assert.equal(ehFeriadoNacional("2025-04-18"), true);
  assert.equal(ehFeriadoNacional("2026-11-20"), true);
  assert.equal(ehFeriadoNacional("2026-11-21"), false);
  assert.equal(ehFeriadoNacional("2026-02-17"), false); // Carnaval: ponto facultativo.
});

test("aprende padrões do dia da semana usando meses completos", () => {
  const parcial = julho.slice(0, 10);
  const resultado = prever(parcial);
  assert.equal(resultado.status, "ok");
  assert.equal(resultado.mesesHistoricos, 12);
  assert.ok(resultado.pesosSemana[0] > resultado.pesosSemana[2]);
  assert.ok(resultado.previsto > resultado.vendido);
});

test("nunca usa o faturamento futuro do próprio mês na previsão", () => {
  const base = prever(julho);
  const alterado = prever(julho.map((item, indice) =>
    indice < 10 ? item : { ...item, valor_vendido: 999999 }));
  assert.equal(base.previsto, alterado.previsto);
});

test("mês alvo não entra na aprendizagem mesmo que conste em historicos", () => {
  const previsto = prever(julho);
  const duplicado = prever(julho, { historicos: [...historicos, ...julho] });
  assert.equal(previsto.previsto, duplicado.previsto);
});

test("ausência, duplicidade e valor inválido bloqueiam previsão; zero explícito não", () => {
  assert.equal(prever(julho.slice(0, 10).filter((v) =>
    !v.data.endsWith("-05"))).status, "lancamentos_incompletos");
  assert.equal(prever([...julho.slice(0, 10), julho[0]]).status,
    "lancamentos_incompletos");
  assert.equal(prever(julho.slice(0, 10).map((v, i) =>
    i === 3 ? { ...v, valor_vendido: -1 } : v)).status,
    "lancamentos_incompletos");
  assert.equal(prever(julho.slice(0, 10).map((v, i) =>
    i === 3 ? { ...v, valor_vendido: 0 } : v)).status, "ok");
});

test("não inventa modelo com meses históricos insuficientes", () => {
  const resultado = prever(julho.slice(0, 10), {
    historicos: historicos.filter((v) => v.data < "2024-09-01"),
  });
  assert.equal(resultado.status, "historico_insuficiente");
  assert.equal(resultado.previsto, null);
});

test("calcula comparação justa em cortes idênticos e sem mês aberto", () => {
  const resultado = compararPrevisoesCalendario({
    vendas: [...historicos, ...julho], lojas: [{ id: 1 }],
    anoLimite: "2025-08", filtroPeriodo: "manha",
  });
  assert.equal(resultado.status, "ok");
  assert.ok(resultado.metricas.meses >= 1);
  assert.ok(resultado.metricas.cortes >= resultado.metricas.meses);
  assert.equal(resultado.meses.at(-1).mes, "2025-07");
  assert.ok(Number.isFinite(resultado.metricas.maeAtual));
  assert.ok(Number.isFinite(resultado.metricas.maeCalendario));
  assert.equal(resultado.metricas.mesesMelhores <= resultado.metricas.meses, true);
});

test("não deixa que um lançamento ausente entre como venda zero no backtest", () => {
  const resultado = compararPrevisoesCalendario({
    vendas: [...historicos, ...julho.filter((v) => !v.data.endsWith("-13"))],
    lojas: [{ id: 1 }], anoLimite: "2025-08", filtroPeriodo: "manha",
  });
  assert.equal(resultado.meses.some((item) => item.mes === "2025-07"), false);
});

test("separa lojas e turnos em vez de transferir padrão de outra loja", () => {
  const vendas = [...historicos, ...gerarMes(2025, 7, () => 100, 2)];
  const resultado = preverFechamentoCalendario({
    vendas, historicos, ano: 2025, numeroMes: 7,
    diaCorte: 10, lojaId: 2, periodo: "manha",
  });
  assert.equal(resultado.status, "historico_insuficiente");
});
