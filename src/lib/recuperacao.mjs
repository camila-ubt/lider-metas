export const RECOVERY_URL = "https://metas-lider.vercel.app/recuperar-senha";
export const PA_URL = "https://calculo-pa.vercel.app/";
export const LIDER_URL = "https://metas-lider.vercel.app/";

export const LINK_INVALIDO = "Este link expirou, já foi usado ou é inválido. Solicite um novo link de recuperação.";

// Incoming failures never fall back to a previously saved session.
export async function validarRecuperacao(auth, endereco) {
  const url = new URL(endereco);
  const fragmento = new URLSearchParams(url.hash.slice(1));

  if (url.searchParams.has("error") || fragmento.has("error")) {
    return { etapa: "solicitar", mensagem: LINK_INVALIDO };
  }

  const accessToken = fragmento.get("access_token");
  const refreshToken = fragmento.get("refresh_token");
  const tipo = fragmento.get("type");

  if (accessToken || refreshToken) {
    if (!accessToken || !refreshToken || (tipo && tipo !== "recovery")) {
      return { etapa: "solicitar", mensagem: LINK_INVALIDO };
    }
    const { data, error } = await auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error || !data?.session) {
      return { etapa: "solicitar", mensagem: LINK_INVALIDO };
    }
  } else {
    const codigo = url.searchParams.get("code");
    if (codigo) {
      const { data, error } = await auth.exchangeCodeForSession(codigo);
      if (error || !data?.session) return { etapa: "solicitar", mensagem: LINK_INVALIDO };
    } else {
      const { data, error } = await auth.getSession();
      if (error || !data?.session) return { etapa: "solicitar", mensagem: "" };
    }
  }

  const { data, error } = await auth.getUser();
  return !error && data?.user
    ? { etapa: "redefinir", mensagem: "" }
    : { etapa: "solicitar", mensagem: LINK_INVALIDO };
}

export function validarNovaSenha(senha, confirmar) {
  if (senha.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
  if (senha !== confirmar) return "As senhas não conferem.";
  return "";
}
