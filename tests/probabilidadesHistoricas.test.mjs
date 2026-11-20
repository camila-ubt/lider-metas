import assert from "node:assert/strict";
import test from "node:test";
import { estimarChancesHistoricas } from "../src/lib/probabilidadesHistoricas.mjs";

const loja = { id: 1, codigo: "CB" };
const periodo = "manha";
const diasMes = (ano, mes) => new Date(ano, mes, 0).getDate();
const mesTexto = (ano, mes) => `${ano}-${String(mes).padStart(2, "0")}`;

function mesCompleto(ano, mes, valor = () => 100, meta = 3000) {
  const prefixo = mesTexto(ano, mes);
  return {
    meta: { mes: prefixo + "-01", loja_id: 1, periodo, valor_meta: meta },
    vendas: Array.from({ length: diasMes(ano, mes) }, (_, i) => ({
      data: prefixo + "-" + String(i + 1).padStart(2, "0"),
      loja_id: 1, periodo, valor_vendido: valor(i + 1),
    })),
  };
}

function historico(anos = [2024, 2025]) {
  const meses = anos.flatMap((ano) =>
    Array.from({ length: ano === 2024 ? 6 : 12 }, (_, i) =>
      mesCompleto(ano, ano === 2024 ? i + 7 : i + 1,
        (dia) => dia <= 15 ? 90 : 130),
    ));
  return {
    metasHistoricas: meses.map((item) => item.meta),
    vendasHistoricas: meses.flatMap((item) => item.vendas),
  };
}

function simular({
  ano = 2026, mes = 11, corte = 20, referencias = historico(), vendaDiaria = 120,
  registros,
  ...extras
} = {}) {
  const atual = mesCompleto(ano, mes, () => vendaDiaria);
  return estimarChancesHistoricas({
    vendas: registros || atual.vendas.slice(0, corte),
    metas: [{ ...atual.meta }],
    lojas: [loja],
    ano, numeroMes: mes, diaLimite: corte,
    filtroPeriodo: "manha",
    ...referencias,
    ...extras,
  });
}

test("usa dois anos do mesmo mês quando disponíveis", () => {
  const r = simular();
  assert.equal(r.status, "ok");
  assert.deepEqual(r.anosMesmoMes, [2024, 2025]);
  assert.equal(r.meses, 18);
  assert.equal(r.mesesMesmoMes, 2);
  assert.equal(r.mesesApoio, 16);
  assert.equal(r.diaBase, 20);
  for (const id of ["meta", "super", "mega"]) {
    assert.equal(r.probabilidades[id] % 5, 0);
    assert.ok(r.probabilidades[id] >= 5 && r.probabilidades[id] <= 95);
  }
  assert.ok(r.probabilidades.meta >= r.probabilidades.super);
  assert.ok(r.probabilidades.super >= r.probabilidades.mega);
});

test("usa somente o mesmo mês do ano anterior quando 2024 não o possui", () => {
  const r = simular({ mes: 2 });
  assert.equal(r.status, "ok");
  assert.deepEqual(r.anosMesmoMes, [2025]);
  assert.equal(r.mesesMesmoMes, 1);
  assert.equal(r.mesesApoio, 17);
  assert.equal(r.meses, 18);
});

test("para 2025 não usa vendas ou metas de 2025 na referência", () => {
  const r = simular({ ano: 2025, mes: 11 });
  assert.equal(r.status, "ok");
  assert.deepEqual(r.anosMesmoMes, [2024]);
  assert.equal(r.mesesMesmoMes, 1);
  assert.equal(r.mesesApoio, 5);
  assert.equal(r.meses, 6);
});

test("nunca lê vendas posteriores ao dia da previsão", () => {
  const mes = mesCompleto(2026, 11, () => 100);
  const a = simular({ corte: 20, registros: mes.vendas });
  const b = simular({
    corte: 20, registros: mes.vendas.map((v, i) => i >= 20
      ? { ...v, valor_vendido: 250000 } : v),
  });
  assert.deepEqual(a, b);
});

test("um registro ausente não vira venda zero", () => {
  const mes = mesCompleto(2026, 11);
  const r = simular({
    corte: 20,
    registros: mes.vendas.slice(0, 20).filter((v) =>
      !v.data.endsWith("-13")),
  });
  assert.equal(r.status, "ok");
  assert.equal(r.diaBase, 12);
});

test("zero registrado é válido, mas duplicidade bloqueia o corte", () => {
  const atual = mesCompleto(2026, 11);
  const zero = atual.vendas.slice(0, 20).map((v, i) =>
    i === 10 ? { ...v, valor_vendido: 0 } : v);
  assert.equal(simular({ registros: zero }).diaBase, 20);
  assert.equal(simular({ registros: [...zero, zero[15]] }).diaBase, 15);
});

test("meta já alcançada torna a chance de Meta igual a 100%", () => {
  const r = simular({ vendaDiaria: 1000 });
  assert.equal(r.status, "ok");
  assert.equal(r.probabilidades.meta, 100);
  assert.equal(r.probabilidades.super, 100);
  assert.equal(r.probabilidades.mega, 100);
});

test("não mistura a manhã de outra loja com a base da loja selecionada", () => {
  const r = simular({
    lojas: [loja, { id: 2, codigo: "AA" }],
    filtroLoja: "1",
    filtroPeriodo: "manha",
  });
  assert.equal(r.status, "ok");
  assert.deepEqual(r.anosMesmoMes, [2024, 2025]);
});

test("faltas no ano de referência excluem aquele mês e reduzem a amostra", () => {
  const refs = historico();
  refs.vendasHistoricas = refs.vendasHistoricas.filter((venda) =>
    venda.data !== "2024-11-12");
  const r = simular({ referencias: refs });
  assert.equal(r.status, "ok");
  assert.deepEqual(r.anosMesmoMes, [2025]);
  assert.equal(r.meses, 17);
});

test("se houver menos de seis meses completos não apresenta porcentagens", () => {
  const refs = historico([2025]);
  refs.metasHistoricas = refs.metasHistoricas.slice(0, 3);
  const r = simular({ referencias: refs });
  assert.equal(r.status, "historico_insuficiente");
  assert.equal(r.probabilidades, null);
});

test("sem vendas suficientes no mês atual não calcula chances", () => {
  const r = simular({ corte: 2 });
  assert.equal(r.status, "sem_base");
  assert.equal(r.probabilidades, null);
});

test("sem meta válida não cria chances numéricas", () => {
  const r = simular({ metas: [] });
  assert.equal(r.status, "sem_metas");
});

test("fevereiro com 29 dias pode servir de referência para fevereiro com 28", () => {
  const refs = historico([2024]);
  const fevereiro = mesCompleto(2024, 2, () => 100);
  refs.metasHistoricas.push(fevereiro.meta);
  refs.vendasHistoricas.push(...fevereiro.vendas);
  const r = simular({ ano: 2025, mes: 2, corte: 20, referencias: refs });
  assert.equal(r.status, "ok");
  assert.deepEqual(r.anosMesmoMes, [2024]);
  assert.ok(r.probabilidades.meta >= r.probabilidades.super);
});
