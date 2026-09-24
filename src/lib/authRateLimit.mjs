const STORAGE_KEY = "lider_metas_auth_rate_limit_v1";

export const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const AUTH_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const AUTH_RATE_LIMIT_BLOCK_MS = 15 * 60 * 1000;

function storagePadrao() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function chave(acao, identificador) {
  return `${acao}:${String(identificador || "geral").trim().toLowerCase()}`;
}

function ler(storage = storagePadrao()) {
  if (!storage) return {};
  try {
    const valor = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
    return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
  } catch {
    return {};
  }
}

function salvar(valor, storage = storagePadrao()) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(valor));
  } catch {
    // O rate limit local é complementar e não deve impedir o fluxo de autenticação.
  }
}

export function obterBloqueioRateLimitAuth(acao, identificador, storage = storagePadrao(), agora = Date.now()) {
  const limite = ler(storage);
  const id = chave(acao, identificador);
  const atual = limite[id];

  if (!atual?.bloqueadoAte) return 0;
  if (atual.bloqueadoAte <= agora) {
    delete limite[id];
    salvar(limite, storage);
    return 0;
  }

  return atual.bloqueadoAte - agora;
}

export function registrarTentativaRateLimitAuth(acao, identificador, storage = storagePadrao(), agora = Date.now()) {
  const limite = ler(storage);
  const id = chave(acao, identificador);
  const atual = limite[id];
  const mesmaJanela = atual && agora - atual.inicioJanela < AUTH_RATE_LIMIT_WINDOW_MS;
  const tentativas = mesmaJanela ? atual.tentativas + 1 : 1;
  const inicioJanela = mesmaJanela ? atual.inicioJanela : agora;
  const bloqueadoAte = tentativas >= AUTH_RATE_LIMIT_MAX_ATTEMPTS
    ? agora + AUTH_RATE_LIMIT_BLOCK_MS
    : null;

  limite[id] = { tentativas, inicioJanela, bloqueadoAte };
  salvar(limite, storage);

  return {
    bloqueadoAte,
    tentativasRestantes: Math.max(AUTH_RATE_LIMIT_MAX_ATTEMPTS - tentativas, 0),
  };
}

export function registrarFalhaRateLimitAuth(acao, identificador, storage = storagePadrao(), agora = Date.now()) {
  return registrarTentativaRateLimitAuth(acao, identificador, storage, agora);
}

export function limparRateLimitAuth(acao, identificador, storage = storagePadrao()) {
  const limite = ler(storage);
  delete limite[chave(acao, identificador)];
  salvar(limite, storage);
}

export function formatarTempoEspera(msRestantes) {
  const segundos = Math.max(1, Math.ceil(msRestantes / 1000));
  if (segundos >= 60) {
    const minutos = Math.ceil(segundos / 60);
    return `${minutos} minuto${minutos === 1 ? "" : "s"}`;
  }
  return `${segundos} segundo${segundos === 1 ? "" : "s"}`;
}

export function validarSenhaSegura(senha) {
  const valor = String(senha || "");
  if (valor.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[a-zà-ÿ]/.test(valor) || !/[A-ZÀ-Ý]/.test(valor) || !/\d/.test(valor)) {
    return "A senha precisa ter letra maiúscula, minúscula e número.";
  }
  return "";
}
