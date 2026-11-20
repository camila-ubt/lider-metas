import assert from "node:assert/strict";
import test from "node:test";
import {
  listarMesesAvaliacao,
  avaliarMetodosEmVariosMeses,
  avaliarSeisMesesPorLojaTurno,
} from "../src/lib/comparacaoHistoricaMetodos.mjs";

const lojas = [{ id: 1, codigo: "CB" }];

function gerarMes(ano, mes, periodo, valor) {
  const qtd = new Date(ano, mes, 0).getDate();
  return Array.from({ length: qtd }, (_, indice) => ({
    data: ano + "-" + String(mes).padStart(2, "0") + "-" +
      String(indice + 1).padStart(2, "0"),
    loja_id: 1, periodo, valor_vendido: valor(indice + 1),
  }));
}
function montar(ano, mes, padrao) {
  const vendas = gerarMes(ano, mes, "manha", padrao);
  const vendasReferencia = gerarMes(ano - 1, mes, "manha", padrao);
  return { ano, numeroMes: mes, vendas, vendasReferencia };
}

test("gera exatamente os seis meses anteriores incluindo o selecionado", () => {
  assert.deepEqual(listarMesesAvaliacao(2026, 2, 6), [
    { ano: 2025, numeroMes: 9 },
    { ano: 2025, numeroMes: 10 },
    { ano: 2025, numeroMes: 11 },
    { ano: 2025, numeroMes: 12 },
    { ano: 2026, numeroMes: 1 },
    { ano: 2026, numeroMes: 2 },
  ]);
});

test("escolhe sazonal apenas após três meses comparáveis", () => {
  const acelerando = (dia) => dia <= 15 ? 100 : 300;
  const meses = [9, 10, 11].map((mes) => montar(2025, mes, acelerando));
  const resultado = avaliarMetodosEmVariosMeses({
    meses, lojas, periodo: "manha",
  });
  assert.equal(resultado.status, "ok");
  assert.equal(resultado.mesesComparaveis, 3);
  assert.deepEqual(resultado.mesesUsados, ["2025-09", "2025-10", "2025-11"]);
  assert.equal(resultado.melhor.id, "sazonal");
  assert.equal(resultado.melhor.mape, 0);
});

test("dois meses não bastam para declarar um método mais preciso", () => {
  const meses = [9, 10].map((mes) => montar(2025, mes, () => 100));
  const r = avaliarMetodosEmVariosMeses({ meses, lojas, periodo: "manha" });
  assert.equal(r.status, "insuficiente");
  assert.equal(r.melhor, null);
});

test("ano anterior ausente exclui sazonal sem descartar outros métodos", () => {
  const meses = [8, 9, 10, 11].map((mes) => ({
    ...montar(2025, mes, (dia) => dia <= 15 ? 100 : 200),
    vendasReferencia: [],
  }));
  const r = avaliarMetodosEmVariosMeses({ meses, lojas, periodo: "manha" });
  assert.equal(r.status, "ok");
  assert.equal(r.mesesComparaveis, 4);
  assert.deepEqual(r.metodos.map((item) => item.id), ["atual", "recente"]);
});

test("não compara sazonais com menos de três meses, mesmo com outros completos", () => {
  const meses = [7, 8, 9, 10, 11].map((mes) => {
    const r = montar(2025, mes, (dia) => dia <= 15 ? 100 : 200);
    if (mes < 10) r.vendasReferencia = [];
    return r;
  });
  const r = avaliarMetodosEmVariosMeses({ meses, lojas, periodo: "manha" });
  assert.equal(r.status, "ok");
  assert.deepEqual(r.metodos.map((item) => item.id), ["atual", "recente"]);
  assert.equal(r.mesesComparaveis, 5);
});

test("comparação separa loja e período sem mistura de vendas", () => {
  const meses = [9, 10, 11].map((mes) => {
    const base = montar(2025, mes, (dia) => dia <= 15 ? 100 : 300);
    return {
      ...base,
      vendas: [...base.vendas, ...gerarMes(2025, mes, "noite", () => 200)],
      vendasReferencia: [
        ...base.vendasReferencia, ...gerarMes(2024, mes, "noite", () => 200),
      ],
    };
  });
  const resultado = avaliarSeisMesesPorLojaTurno({ meses, lojas });
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].periodo, "manha");
  assert.equal(resultado[1].periodo, "noite");
  assert.equal(resultado[0].avaliacao.melhor.id, "sazonal");
  assert.ok(resultado[1].avaliacao.melhor !== null);
});
