import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_RATE_LIMIT_BLOCK_MS,
  AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  limparRateLimitAuth,
  obterBloqueioRateLimitAuth,
  registrarFalhaRateLimitAuth,
  validarSenhaSegura,
} from "../src/lib/authRateLimit.mjs";
import { validarNovaSenha } from "../src/lib/recuperacao.mjs";

function memoria() {
  const dados = new Map();
  return {
    getItem: (chave) => dados.has(chave) ? dados.get(chave) : null,
    setItem: (chave, valor) => dados.set(chave, String(valor)),
  };
}

test("senha nova exige 8 caracteres, maiúscula, minúscula e número", () => {
  assert.ok(validarSenhaSegura("Abc123"));
  assert.ok(validarSenhaSegura("abcdefgh"));
  assert.ok(validarSenhaSegura("ABCDEFG1"));
  assert.ok(validarSenhaSegura("Abcdefgh"));
  assert.equal(validarSenhaSegura("Senha123"), "");
  assert.equal(validarNovaSenha("Senha123", "Senha123"), "");
  assert.ok(validarNovaSenha("Senha123", "Senha124"));
});

test("rate limit bloqueia após cinco falhas e expira depois do período", () => {
  const storage = memoria();
  const inicio = 1_000_000;

  for (let tentativa = 1; tentativa <= AUTH_RATE_LIMIT_MAX_ATTEMPTS; tentativa += 1) {
    registrarFalhaRateLimitAuth("login", "USUARIO@EXEMPLO.COM", storage, inicio + tentativa);
  }

  const bloqueio = obterBloqueioRateLimitAuth("login", "usuario@exemplo.com", storage, inicio + 10);
  assert.ok(bloqueio > 0);
  assert.ok(bloqueio <= AUTH_RATE_LIMIT_BLOCK_MS);

  assert.equal(
    obterBloqueioRateLimitAuth("login", "usuario@exemplo.com", storage, inicio + AUTH_RATE_LIMIT_BLOCK_MS + 100),
    0
  );
});

test("sucesso limpa o contador do identificador", () => {
  const storage = memoria();
  registrarFalhaRateLimitAuth("cadastro", "pessoa@exemplo.com", storage, 10);
  limparRateLimitAuth("cadastro", "pessoa@exemplo.com", storage);
  assert.equal(obterBloqueioRateLimitAuth("cadastro", "pessoa@exemplo.com", storage, 20), 0);
});
