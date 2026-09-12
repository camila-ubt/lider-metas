import test from "node:test";
import assert from "node:assert/strict";
import { RECOVERY_URL, validarRecuperacao, validarNovaSenha } from "./recuperacao.mjs";

const session = { user: { id: "fixture" } };
const verified = async () => ({ data: { user: session.user }, error: null });

test("the email destination is the shared HTTPS production route", () => {
  assert.equal(RECOVERY_URL, "https://metas-lider.vercel.app/recuperar-senha");
});

test("recovery tokens from the email unlock reset in any browser", async () => {
  let sessions = 0;
  const auth = {
    setSession: async ({ access_token, refresh_token }) => {
      sessions++;
      assert.equal(access_token, "access-fixture");
      assert.equal(refresh_token, "refresh-fixture");
      return { data: { session }, error: null };
    },
    getUser: verified,
  };
  const url = `${RECOVERY_URL}#access_token=access-fixture&refresh_token=refresh-fixture&type=recovery`;
  assert.equal((await validarRecuperacao(auth, url)).etapa, "redefinir");
  assert.equal(sessions, 1);
});

test("valid PKCE code remains supported for older emails", async () => {
  let exchanges = 0;
  const auth = { exchangeCodeForSession: async (code) => { exchanges++; assert.equal(code, "fixture"); return { data: { session } }; }, getUser: verified };
  assert.equal((await validarRecuperacao(auth, `${RECOVERY_URL}?code=fixture`)).etapa, "redefinir");
  assert.equal(exchanges, 1);
});

test("invalid or reused code never falls back to a saved session", async () => {
  const auth = { exchangeCodeForSession: async () => ({ error: new Error("expired") }), getSession: () => assert.fail("must not use an old session"), getUser: () => assert.fail("must not unlock") };
  assert.equal((await validarRecuperacao(auth, `${RECOVERY_URL}?code=expired`)).etapa, "solicitar");
});

test("provider error or incomplete recovery fragment fail closed", async () => {
  for (const suffix of ["?error=access_denied", "#error=access_denied", "#access_token=fixture&type=recovery", "#refresh_token=fixture&type=recovery"]) {
    assert.equal((await validarRecuperacao({}, RECOVERY_URL + suffix)).etapa, "solicitar");
  }
});

test("ordinary visit needs a recovery-only saved session and a verified user", async () => {
  const empty = { getSession: async () => ({ data: { session: null } }) };
  assert.equal((await validarRecuperacao(empty, RECOVERY_URL)).etapa, "solicitar");
  const saved = { getSession: async () => ({ data: { session } }), getUser: verified };
  assert.equal((await validarRecuperacao(saved, RECOVERY_URL)).etapa, "redefinir");
  saved.getUser = async () => ({ data: { user: null }, error: new Error("revoked") });
  assert.equal((await validarRecuperacao(saved, RECOVERY_URL)).etapa, "solicitar");
});

test("password validation rejects short or mismatching values", () => {
  assert.ok(validarNovaSenha("abc", "abc"));
  assert.ok(validarNovaSenha("example-one", "example-two"));
  assert.equal(validarNovaSenha("example-one", "example-one"), "");
});
