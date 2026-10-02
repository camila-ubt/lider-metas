import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("folha de metas permanece visível no modo de impressão", async () => {
  const componente = await readFile(
    new URL("../src/components/MetasImpressao.js", import.meta.url),
    "utf8",
  );

  assert.match(
    componente,
    /body\.metas-print-active #metas-print-sheet,\s*body\.metas-print-active #metas-print-sheet \* \{\s*visibility: visible !important;/,
  );
});
