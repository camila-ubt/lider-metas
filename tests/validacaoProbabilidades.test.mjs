import assert from "node:assert/strict";
import test from "node:test";
import {
  DIAS_CALIBRACAO,
  resumirCalibracaoProbabilidades,
  validarCalibracaoProbabilidades,
} from "../src/lib/validacaoProbabilidades.mjs";

const lojas = [{ id: 1, codigo: "CB" }];
const doisDigitos = (valor) => String(valor).padStart(2, "0");

function montarMes(ano, mes, valor = () => 100, meta = 3000) {
  const prefixo = String(ano) + "-" + doisDigitos(mes);
  const dias = new Date(ano, mes, 0).getDate();
  return {
    meta: { mes: prefixo + "-01", loja_id: 1, periodo: "manha", valor_meta: meta },
    vendas: Array.from({ length: dias }, (_, indice) => ({
      data: prefixo + "-" + doisDigitos(indice + 1),
      loja_id: 1, periodo: "manha",
      valor_vendido: valor(indice + 1),
    })),
  };
}

function montarHistorico() {
  const meses = [];
  for (let ano = 2024; ano <= 2026; ano += 1) {
    const primeiro = ano === 2024 ? 7 : 1;
    const ultimo = ano === 2026 ? 10 : 12;
    for (let mes = primeiro; mes <= ultimo; mes += 1) {
      meses.push(montarMes(ano, mes));
    }
  }
  return {
    vendas: meses.flatMap((item) => item.vendas),
    metas: meses.map((item) => item.meta),
  };
}

function validar(dados = montarHistorico(), extras = {}) {
  return validarCalibracaoProbabilidades({
    ...dados, lojas, anoLimite: "2026-11", filtroPeriodo: "manha", ...extras,
  });
}

test("testa apenas meses completos anteriores ao limite nos cinco dias", () => {
  const resultado = validar();
  assert.equal(resultado.status, "ok");
  assert.equal(resultado.mesesCompletos, 28);
  assert.equal(resultado.mesesInvalidos, 0);
  assert.ok(resultado.mesesAvaliados > 0);
  assert.deepEqual(
    [...new Set(resultado.observacoes
      .filter((item) => item.mes === "2026-10")
      .map((item) => item.diaCorte))],
    DIAS_CALIBRACAO,
  );
  assert.ok(resultado.observacoes.every((item) => item.mes < "2026-11"));
  assert.ok(resultado.observacoes.every((item) => item.mes >= "2025-01"));
  assert.ok(resultado.observacoes.every((item) =>
    item.probabilidades.meta >= item.probabilidades.super &&
    item.probabilidades.super >= item.probabilidades.mega));
});

test("não usa o fechamento futuro para calcular chance do dia 10", () => {
  const dados = montarHistorico();
  const original = validar(dados, { diasCorte: [10] }).observacoes
    .find((item) => item.mes === "2026-02");
  assert.ok(original);

  const alterado = {
    ...dados,
    vendas: dados.vendas.map((venda) =>
      venda.data === "2026-02-25"
        ? { ...venda, valor_vendido: 10000 }
        : venda),
  };
  const resultado = validar(alterado, { diasCorte: [10] }).observacoes
    .find((item) => item.mes === "2026-02");
  assert.deepEqual(resultado.probabilidades, original.probabilidades);
  assert.notDeepEqual(resultado.atingiu, original.atingiu);
});

test("mês com lançamento faltante não entra na calibração", () => {
  const dados = montarHistorico();
  dados.vendas = dados.vendas.filter((venda) => venda.data !== "2026-03-08");
  const resultado = validar(dados);
  assert.equal(resultado.mesesInvalidos, 1);
  assert.ok(resultado.observacoes.every((item) => item.mes !== "2026-03"));
});

test("mês com lançamento duplicado é excluído, mas zero explícito é válido", () => {
  const dados = montarHistorico();
  const zero = dados.vendas.find((venda) => venda.data === "2026-03-08");
  zero.valor_vendido = 0;
  const normal = validar(dados);
  assert.ok(normal.observacoes.some((item) => item.mes === "2026-03"));
  dados.vendas.push({ ...zero });
  const duplicado = validar(dados);
  assert.equal(duplicado.mesesInvalidos, 1);
  assert.ok(duplicado.observacoes.every((item) => item.mes !== "2026-03"));
});

test("não inventa resultados quando o recorte não tem referências válidas", () => {
  const dados = montarMes(2026, 10);
  const resultado = validar({
    vendas: dados.vendas, metas: [dados.meta],
  });
  assert.equal(resultado.status, "sem_amostra");
  assert.equal(resultado.observacoes.length, 0);
});

test("filtro de loja e período impede cruzar vendas de outro turno", () => {
  const dados = montarHistorico();
  const resultado = validar(dados, { filtroPeriodo: "todos" });
  assert.equal(resultado.status, "sem_amostra");
  assert.equal(resultado.mesesCompletos, 0);
});

test("Brier, frequência observada e faixa de 70% usam apenas o corte selecionado", () => {
  const obs = [
    { mes: "2026-01", diaCorte: 5,
      probabilidades: { meta: 70, super: 40, mega: 20 },
      atingiu: { meta: 1, super: 0, mega: 0 } },
    { mes: "2026-02", diaCorte: 5,
      probabilidades: { meta: 70, super: 40, mega: 20 },
      atingiu: { meta: 0, super: 0, mega: 0 } },
    { mes: "2026-01", diaCorte: 20,
      probabilidades: { meta: 100, super: 90, mega: 70 },
      atingiu: { meta: 1, super: 0, mega: 0 } },
  ];

  const resultado = resumirCalibracaoProbabilidades(obs, 5);
  assert.equal(resultado.meses, 2);
  assert.equal(resultado.niveis.meta.amostras, 2);
  assert.equal(resultado.niveis.meta.chanceMedia, 70);
  assert.equal(resultado.niveis.meta.frequenciaReal, 50);
  assert.equal(resultado.niveis.meta.desvioPp, 20);
  assert.ok(Math.abs(resultado.niveis.meta.brier - 0.29) < 1e-10);
  const faixa70 = resultado.niveis.meta.faixas.find((item) => item.rotulo === "60–79%");
  assert.equal(faixa70.meses, 2);
  assert.equal(faixa70.frequenciaReal, 50);
  assert.equal(resumirCalibracaoProbabilidades(obs, 20).niveis.meta.amostras, 1);
});

test("sem observações não exibe probabilidade nem Brier artificial", () => {
  const resultado = resumirCalibracaoProbabilidades([], 25);
  assert.equal(resultado.niveis.meta.amostras, 0);
  assert.equal(resultado.niveis.meta.chanceMedia, null);
  assert.equal(resultado.niveis.meta.brier, null);
});

test("rejeita limites, recortes e dias de corte inválidos", () => {
  assert.equal(validar(montarHistorico(), { anoLimite: "2026-99" }).status,
    "parametros_invalidos");
  assert.equal(validar(montarHistorico(), { filtroPeriodo: "tarde" }).status,
    "parametros_invalidos");
  assert.equal(validar(montarHistorico(), { diasCorte: [1, 2, 31] }).status,
    "parametros_invalidos");
});
