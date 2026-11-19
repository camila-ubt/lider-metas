import test from "node:test";
import assert from "node:assert/strict";
import { gerarHistoricoMetaLojaDia } from "../src/lib/historicoMetaLojaDia.mjs";

const base = {
  metaMensal: 9000,
  quantidadeLojas: 3,
  totalDias: 30,
  diaCorte: 3,
  mesAtual: false,
  vendas: [
    { data: "2026-11-01", valor_vendido: 300 },
    { data: "2026-11-01", valor_vendido: 100 },
    { data: "2026-11-02", valor_vendido: 500 },
  ],
};

test("reconstrói o saldo acumulado e os dias restantes após cada dia", () => {
  const [dia1, dia2, dia3] = gerarHistoricoMetaLojaDia(base);
  assert.equal(dia1.acumulado, 400);
  assert.equal(dia1.diasRestantes, 29);
  assert.ok(Math.abs(dia1.necessario - 8600 / (29 * 3)) < 1e-8);
  assert.equal(dia2.acumulado, 900);
  assert.equal(dia2.diasRestantes, 28);
  assert.equal(dia3.acumulado, 900);
  assert.equal(dia3.vendidoDia, 0);
  assert.equal(dia3.fixa, 100);
});

test("o último dia em andamento segue exatamente os dias restantes exibidos no card", () => {
  const historico = gerarHistoricoMetaLojaDia({
    ...base, mesAtual: true, diasRestantesAtual: 28,
  });
  const hoje = historico.at(-1);
  assert.equal(hoje.diasRestantes, 28);
  assert.ok(Math.abs(hoje.necessario - (9000 - 900) / (28 * 3)) < 1e-8);
});

test("passa para a próxima etapa e compara com a meta fixa da mesma etapa", () => {
  const historico = gerarHistoricoMetaLojaDia({
    ...base, diaCorte: 1, vendas: [{ data: "2026-11-01", valor_vendido: 9100 }],
  });
  assert.equal(historico[0].nivel, "Supermeta");
  assert.equal(historico[0].fixa, 110);
  assert.ok(Math.abs(historico[0].necessario - (9900 - 9100) / 87) < 1e-8);
});

test("ao conquistar a Megameta não apresenta meta diária necessária", () => {
  const historico = gerarHistoricoMetaLojaDia({
    ...base, diaCorte: 1, vendas: [{ data: "2026-11-01", valor_vendido: 10800 }],
  });
  assert.equal(historico[0].concluida, true);
  assert.equal(historico[0].necessario, null);
});

test("não inventa dias anteriores nem divide por zero no último dia encerrado", () => {
  assert.deepEqual(gerarHistoricoMetaLojaDia({ ...base, diaCorte: 0 }), []);
  const historico = gerarHistoricoMetaLojaDia({
    ...base, totalDias: 1, diaCorte: 1, vendas: [], mesAtual: false,
  });
  assert.equal(historico[0].necessario, null);
  assert.equal(historico[0].diasRestantes, 0);
});
 
test("exibe desvio percentual contra a meta fixa e mudança em pontos percentuais", () => {
  const [dia1, dia2] = gerarHistoricoMetaLojaDia(base);
  // Dia 1: (8600 / 87) comparado à meta fixa de R$ 100.
  assert.equal(dia1.desvioPercentual, -1.1);
  assert.equal(dia1.variacaoPp, null);
  // Dia 2: (8100 / 84) comparado à meta fixa de R$ 100.
  assert.equal(dia2.desvioPercentual, -3.6);
  assert.equal(dia2.variacaoPp, -2.5);
});

test("não compara diretamente os desvios de etapas diferentes", () => {
  const registros = gerarHistoricoMetaLojaDia({
    ...base, diaCorte: 2, vendas: [
      { data: "2026-11-01", valor_vendido: 8500 },
      { data: "2026-11-02", valor_vendido: 600 },
    ],
  });
  assert.equal(registros[0].nivel, "Meta");
  assert.equal(registros[1].nivel, "Supermeta");
  assert.equal(registros[1].mudouNivel, true);
  assert.equal(registros[1].variacaoPp, null);
  assert.equal(registros[1].fixa, 110);
});

test("sem dias restantes ou com jornada concluída não inventa porcentagens", () => {
  const ultimo = gerarHistoricoMetaLojaDia({
    ...base, totalDias: 1, diaCorte: 1, vendas: [],
  })[0];
  assert.equal(ultimo.desvioPercentual, null);
  const completo = gerarHistoricoMetaLojaDia({
    ...base, diaCorte: 1, vendas: [
      { data: "2026-11-01", valor_vendido: 12000 },
    ],
  })[0];
  assert.equal(completo.desvioPercentual, null);
});
