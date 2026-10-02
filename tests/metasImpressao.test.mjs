import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularMetasDiariasLoja,
  formatarMesAno,
} from "../src/lib/metasImpressao.mjs";

test("calcula Meta, Super e Mega diárias por manhã, noite e total", () => {
  const metas = [
    { loja_id: 1, periodo: "manha", valor_meta: 11610 },
    { loja_id: 1, periodo: "noite", valor_meta: 17400 },
  ];

  assert.deepEqual(
    calcularMetasDiariasLoja({ metas, lojaId: 1, totalDias: 30 }),
    [
      { sigla: "M", meta: 387, super: 425, mega: 464 },
      { sigla: "N", meta: 580, super: 638, mega: 696 },
      { sigla: "T", meta: 967, super: 1063, mega: 1160 },
    ],
  );
});

test("ignora metas de outras lojas", () => {
  const metas = [
    { loja_id: 1, periodo: "manha", valor_meta: 3100 },
    { loja_id: 2, periodo: "manha", valor_meta: 6200 },
  ];

  const [manha] = calcularMetasDiariasLoja({
    metas,
    lojaId: 1,
    totalDias: 31,
  });

  assert.equal(manha.meta, 100);
});

test("formata o mês no padrão do comprovante", () => {
  assert.equal(formatarMesAno("2026-09"), "setembro/26");
});
