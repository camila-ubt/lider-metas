import assert from "node:assert/strict";
import test from "node:test";
import { analisarHistoricoMes } from "../src/lib/historicoMes.mjs";

const lojas = [{ id: 1 }, { id: 2 }];
function gerarMes(ano, mes, ateDia, totalPorDia = () => 100, ausentes = []) {
  const vendas = [];
  for (let dia = 1; dia <= ateDia; dia += 1) {
    if (ausentes.includes(dia)) continue;
    const data = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    for (const loja_id of [1, 2]) {
      for (const periodo of ["manha", "noite"]) {
        vendas.push({ data, loja_id, periodo, valor_vendido: totalPorDia(dia) / 4 });
      }
    }
  }
  return vendas;
}
const historicos = [
  ...gerarMes(2024, 10, 31, () => 100),
  ...gerarMes(2025, 10, 31, () => 110),
];

test("mostra dias fortes e fracos históricos antes de formar amostra atual", () => {
  const variaveis = [
    ...gerarMes(2024, 10, 31, (dia) => {
      const weekday = new Date(2024, 9, dia).getDay();
      return weekday === 4 ? 200 : weekday === 0 ? 50 : 100;
    }),
    ...gerarMes(2025, 10, 31, (dia) => {
      const weekday = new Date(2025, 9, dia).getDay();
      return weekday === 4 ? 200 : weekday === 0 ? 50 : 100;
    }),
  ];
  const r = analisarHistoricoMes({
    historicos: variaveis,
    vendasAtuais: gerarMes(2026, 10, 2), lojas,
    ano: 2026, numeroMes: 10, diaCorte: 2,
  });
  assert.equal(r.diaForte.nome, "quinta-feira");
  assert.equal(r.diaFraco.nome, "domingo");
  assert.deepEqual(r.referencias.map((item) => item.ano), [2024, 2025]);
  assert.equal(r.comparacao, null);
});

test("distingue crescimento dos anos anteriores do ritmo do ano atual", () => {
  const r = analisarHistoricoMes({
    historicos, vendasAtuais: gerarMes(2026, 10, 7, () => 150),
    lojas, ano: 2026, numeroMes: 10, diaCorte: 8,
  });
  assert.ok(Math.abs(r.variacaoMediaDiaria - 10) < 0.00001);
  assert.equal(r.comparacao.dia, 7);
  assert.equal(r.comparacao.variacao.toFixed(3), (100 * (150 / 105 - 1)).toFixed(3));
  assert.deepEqual(r.comparacao.anos, [2024, 2025]);
  assert.equal(r.projecao.dia, 7);
  assert.ok(r.projecao.valor > r.comparacao.atual);
});

test("não confunde lançamento parcial do dia de hoje com queda nas vendas", () => {
  const atual = [
    ...gerarMes(2026, 10, 7, () => 100),
    { data: "2026-10-08", loja_id: 1, periodo: "manha", valor_vendido: 10 },
  ];
  const r = analisarHistoricoMes({
    historicos, vendasAtuais: atual, lojas,
    ano: 2026, numeroMes: 10, diaCorte: 8,
  });
  assert.equal(r.comparacao.dia, 7);
  assert.equal(r.comparacao.atual, 700);
});

test("exclui ano histórico sem pelo menos 80% de dias completos", () => {
  const r = analisarHistoricoMes({
    historicos: [
      ...gerarMes(2024, 10, 31, () => 100, [1, 2, 3, 4, 5, 6, 7]),
      ...gerarMes(2025, 10, 31, () => 100),
    ],
    vendasAtuais: gerarMes(2026, 10, 7),
    lojas, ano: 2026, numeroMes: 10, diaCorte: 8,
  });
  assert.deepEqual(r.referencias.map((item) => item.ano), [2025]);
  assert.equal(r.variacaoMediaDiaria, null);
  assert.deepEqual(r.comparacao.anos, [2025]);
});

test("não gera projeção se os meses antigos estiverem incompletos", () => {
  const r = analisarHistoricoMes({
    historicos: [
      ...gerarMes(2024, 10, 31, () => 100, [30]),
      ...gerarMes(2025, 10, 31, () => 110, [31]),
    ],
    vendasAtuais: gerarMes(2026, 10, 7),
    lojas, ano: 2026, numeroMes: 10, diaCorte: 8,
  });
  assert.equal(r.projecao, null);
  assert.ok(r.comparacao !== null);
});

test("não calcula comparação nem previsão com dia anterior incompleto", () => {
  const r = analisarHistoricoMes({
    historicos,
    vendasAtuais: gerarMes(2026, 10, 7, () => 100, [2]),
    lojas, ano: 2026, numeroMes: 10, diaCorte: 8,
  });
  assert.equal(r.comparacao, null);
  assert.equal(r.projecao, null);
});

test("padrão histórico funciona para mês futuro sem inventar previsão", () => {
  const r = analisarHistoricoMes({
    historicos,
    vendasAtuais: [], lojas,
    ano: 2026, numeroMes: 10, diaCorte: 0, tipo: "futuro",
  });
  assert.equal(r.referencias.length, 2);
  assert.equal(r.comparacao, null);
  assert.equal(r.projecao, null);
});

test("ignora anos não solicitados e lojas inativas ao agregar", () => {
  const extras = [
    ...gerarMes(2023, 10, 31, () => 1000),
    { data: "2025-10-01", loja_id: 999, periodo: "manha", valor_vendido: 3000 },
  ];
  const r = analisarHistoricoMes({
    historicos: [...historicos, ...extras],
    vendasAtuais: gerarMes(2026, 10, 7, () => 100),
    lojas, ano: 2026, numeroMes: 10, diaCorte: 8,
  });
  assert.equal(r.comparacao.historico, 735);
});
