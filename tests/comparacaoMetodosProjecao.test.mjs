import assert from "node:assert/strict";
import test from "node:test";
import {
  compararMetodosProjecao,
  compararMetodosPorLojaTurno,
} from "../src/lib/comparacaoMetodosProjecao.mjs";

const lojas = [{ id: 1, codigo: "CB" }, { id: 2, codigo: "AA" }];

function gerar(ano, mes, loja_id, periodo, valor) {
  return Array.from({ length: new Date(ano, mes, 0).getDate() }, (_, indice) => {
    const dia = indice + 1;
    return {
      data: ano + "-" + String(mes).padStart(2, "0") + "-" + String(dia).padStart(2, "0"),
      loja_id, periodo, valor_vendido: valor(dia),
    };
  });
}

const teste = (vendas, vendasReferencia = [], opcoes = {}) => compararMetodosProjecao({
  vendas, vendasReferencia, lojas: [lojas[0]], ano: 2025, numeroMes: 11,
  periodo: "manha", ...opcoes,
});

function modelo(resultado, id) {
  return resultado.modelos.find((item) => item.id === id);
}

test("média dos últimos sete dias reage a mudança forte de ritmo", () => {
  const vendas = gerar(2025, 11, 1, "manha", (dia) => dia <= 15 ? 100 : 300);
  const resultado = teste(vendas);
  assert.equal(resultado.status, "ok");
  const atual = modelo(resultado, "atual");
  const recente = modelo(resultado, "recente");
  assert.equal(atual.avaliacoes[3].previsto, 4500);
  assert.ok(recente.avaliacoes[3].previsto > atual.avaliacoes[3].previsto);
  assert.ok(recente.metricas.mape < atual.metricas.mape);
});

test("padrão sazonal pode prever aceleração na segunda metade do mês", () => {
  const valor = (dia) => dia <= 15 ? 100 : 300;
  const vendas = gerar(2025, 11, 1, "manha", valor);
  const anterior = gerar(2024, 11, 1, "manha", valor);
  const resultado = teste(vendas, anterior);
  const sazonal = modelo(resultado, "sazonal");
  assert.ok(sazonal.disponivel);
  assert.equal(sazonal.metricas.mape, 0);
  assert.equal(resultado.melhor.id, "sazonal");
  assert.equal(sazonal.avaliacoes[0].previsto, 6000);
});

test("sem ano anterior não fabrica previsão sazonal", () => {
  const resultado = teste(gerar(2025, 11, 1, "manha", () => 100));
  const sazonal = modelo(resultado, "sazonal");
  assert.equal(sazonal.disponivel, false);
  assert.equal(sazonal.metricas, null);
  assert.ok(resultado.melhor);
});

test("métodos não leem vendas futuras ao calcular dia 5", () => {
  const anoAnterior = gerar(2024, 11, 1, "manha", (dia) => dia <= 15 ? 100 : 300);
  const curto = teste(gerar(2025, 11, 1, "manha",
    (dia) => dia <= 5 ? 100 : 200), anoAnterior);
  const longo = teste(gerar(2025, 11, 1, "manha",
    (dia) => dia <= 5 ? 100 : 800), anoAnterior);
  for (const id of ["atual", "recente", "sazonal"]) {
    assert.equal(modelo(curto, id).avaliacoes[0].previsto,
      modelo(longo, id).avaliacoes[0].previsto);
  }
  assert.notEqual(curto.totalRealizado, longo.totalRealizado);
});

test("histórico anterior incompleto não invalida métodos sem sazonalidade", () => {
  const vendas = gerar(2025, 11, 1, "manha", () => 100);
  const referencia = gerar(2024, 11, 1, "manha", () => 100).slice(0, 25);
  const r = teste(vendas, referencia);
  assert.equal(r.status, "ok");
  assert.equal(modelo(r, "sazonal").disponivel, false);
  assert.equal(modelo(r, "atual").metricas.mape, 0);
});

test("dias sem lançamentos bloqueiam a validação, zero registrado não bloqueia", () => {
  const vendas = gerar(2025, 11, 1, "manha", (dia) => dia === 5 ? 0 : 100);
  assert.equal(teste(vendas).status, "ok");
  assert.equal(teste(vendas.slice(1)).status, "base_incompleta");
});

test("reflete a diferença dos 28 e 29 dias de fevereiro sem buscar dados futuros", () => {
  const vendas = gerar(2025, 2, 1, "manha", () => 100);
  const referencia = gerar(2024, 2, 1, "manha", () => 100);
  const r = teste(vendas, referencia, { numeroMes: 2 });
  assert.equal(r.status, "ok");
  assert.equal(modelo(r, "sazonal").disponivel, true);
  for (const item of modelo(r, "sazonal").avaliacoes) {
    assert.ok(Number.isFinite(item.previsto));
    assert.ok(item.previsto > 0);
  }
});

test("agrupamento permite escolher melhor método por loja e turno", () => {
  const vendas = [
    ...gerar(2025, 11, 1, "manha", (dia) => dia <= 15 ? 100 : 300),
    ...gerar(2025, 11, 1, "noite", () => 200),
    ...gerar(2025, 11, 2, "manha", () => 100),
    ...gerar(2025, 11, 2, "noite", () => 300),
  ];
  const referencia = [
    ...gerar(2024, 11, 1, "manha", (dia) => dia <= 15 ? 100 : 300),
    ...gerar(2024, 11, 1, "noite", () => 200),
    ...gerar(2024, 11, 2, "manha", () => 100),
    ...gerar(2024, 11, 2, "noite", () => 300),
  ];
  const grupos = compararMetodosPorLojaTurno({
    vendas, vendasReferencia: referencia, lojas,
    ano: 2025, numeroMes: 11,
  });
  assert.equal(grupos.length, 4);
  assert.equal(grupos.every((item) => item.status === "ok"), true);
  assert.equal(grupos[0].melhor.id, "sazonal");
  assert.ok(grupos[1].melhor);
});
