import assert from "node:assert/strict";
import test from "node:test";

import { classificarProjecao } from "../src/lib/classificarProjecao.mjs";

test("classifica abaixo da Meta, Meta, Supermeta e Megameta nos limites corretos", () => {
  assert.deepEqual(classificarProjecao(999.99, 1000), {
    rotulo: "Abaixo da Meta", tom: "abaixo",
  });
  assert.deepEqual(classificarProjecao(1000, 1000), {
    rotulo: "Meta", tom: "meta",
  });
  assert.deepEqual(classificarProjecao(1099.99, 1000), {
    rotulo: "Meta", tom: "meta",
  });
  assert.deepEqual(classificarProjecao(1100, 1000), {
    rotulo: "Supermeta", tom: "super",
  });
  assert.deepEqual(classificarProjecao(1199.99, 1000), {
    rotulo: "Supermeta", tom: "super",
  });
  assert.deepEqual(classificarProjecao(1200, 1000), {
    rotulo: "Megameta", tom: "mega",
  });
});

test("mantém zero como projeção abaixo da Meta, não como dado indisponível", () => {
  assert.equal(classificarProjecao(0, 1000).rotulo, "Abaixo da Meta");
});

test("sem projeção ou sem meta não informa um nível indevido", () => {
  assert.deepEqual(classificarProjecao(null, 1000), {
    rotulo: "Sem projeção", tom: "neutro",
  });
  assert.deepEqual(classificarProjecao(undefined, 1000), {
    rotulo: "Sem projeção", tom: "neutro",
  });
  assert.deepEqual(classificarProjecao(NaN, 1000), {
    rotulo: "Sem projeção", tom: "neutro",
  });
  assert.deepEqual(classificarProjecao(1500, 0), {
    rotulo: "Sem meta", tom: "neutro",
  });
});

test("aplica os mesmos níveis à projeção da loja e de cada turno, conforme a meta própria", () => {
  const loja = classificarProjecao(30381.12, 28200);
  const manha = classificarProjecao(13891.91, 11300);
  const noite = classificarProjecao(16489.21, 16900);
  assert.equal(loja.rotulo, "Meta");
  assert.equal(manha.rotulo, "Megameta");
  assert.equal(noite.rotulo, "Abaixo da Meta");
});
