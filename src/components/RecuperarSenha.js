"use client";

import { useEffect, useRef, useState } from "react";
import { getRecoveryClient } from "@/lib/supabase/recovery-client";
import { RECOVERY_URL, PA_URL, LIDER_URL, LINK_INVALIDO, validarRecuperacao, validarNovaSenha } from "@/lib/recuperacao.mjs";
import styles from "./RecuperarSenha.module.css";

export default function RecuperarSenha() {
  const clientRef = useRef(null);
  const inicializacao = useRef(null);
  const [etapa, setEtapa] = useState("carregando");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");

  useEffect(() => {
    let ativo = true;
    if (!inicializacao.current) {
      const endereco = window.location.href;
      // Remove codes/errors from the address bar before rendering links or forms.
      window.history.replaceState({}, "", window.location.pathname);
      inicializacao.current = (async () => {
        clientRef.current = getRecoveryClient();
        return validarRecuperacao(clientRef.current.auth, endereco);
      })();
    }
    inicializacao.current.then((resultado) => {
      if (ativo) { setEtapa(resultado.etapa); setMensagem(resultado.mensagem); }
    }).catch(() => {
      if (ativo) { setEtapa("solicitar"); setMensagem("Não foi possível conectar. Tente novamente em instantes."); }
    });
    return () => { ativo = false; };
  }, []);

  async function enviar(evento) {
    evento.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setMensagem("");
    try {
      const client = clientRef.current || getRecoveryClient();
      clientRef.current = client;
      // Requests must originate on this shared production page, even from PA.
      if (window.location.origin !== new URL(RECOVERY_URL).origin) {
        setMensagem("Para receber o link, abra a página oficial de recuperação abaixo.");
        return;
      }
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: RECOVERY_URL });
      if (error) {
        setMensagem(error.status === 429 ? "Aguarde alguns minutos antes de pedir outro link." : "Não foi possível enviar o link. Tente novamente em instantes.");
      } else {
        setEtapa("enviado");
      }
    } catch {
      setMensagem("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally { setOcupado(false); }
  }

  async function salvar(evento) {
    evento.preventDefault();
    if (ocupado || etapa !== "redefinir") return;
    const erro = validarNovaSenha(senha, confirmar);
    if (erro) { setMensagem(erro); return; }
    setOcupado(true);
    setMensagem("");
    try {
      const { data, error: erroSessao } = await clientRef.current.auth.getUser();
      if (erroSessao || !data?.user) {
        setEtapa("solicitar"); setMensagem(LINK_INVALIDO); setSenha(""); setConfirmar(""); return;
      }
      const { error } = await clientRef.current.auth.updateUser({ password: senha });
      if (error) {
        setMensagem(error.code === "same_password" ? "Escolha uma senha diferente da atual." : "Não foi possível alterar a senha. Use uma senha mais forte ou solicite um novo link.");
        return;
      }
      setSenha(""); setConfirmar(""); setEtapa("concluido");
      // Invalidate refresh sessions for this shared identity after changing its password.
      const { error: erroSaida } = await clientRef.current.auth.signOut({ scope: "global" });
      if (erroSaida) setMensagem("Senha alterada. Não foi possível encerrar todas as sessões; saia dos aplicativos antes de entrar novamente.");
    } catch {
      setMensagem("A conexão foi interrompida. Se a senha não foi alterada, tente novamente.");
    } finally { setOcupado(false); }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-busy={ocupado || etapa === "carregando"}>
        <div className={styles.brands}><span>PA</span><span>LM</span></div>
        <p className={styles.eyebrow}>PA · Líder Metas</p>
        <h1>{etapa === "redefinir" ? "Crie sua nova senha" : etapa === "concluido" ? "Senha alterada" : etapa === "enviado" ? "Confira seu e-mail" : "Recuperar senha"}</h1>
        <p className={styles.description}>Uma única senha para sua conta no PA e no Líder Metas. O acesso autorizado em cada aplicativo permanece o mesmo.</p>
        {etapa === "carregando" && <p role="status">Verificando seu link…</p>}
        {etapa === "solicitar" && <form onSubmit={enviar} className={styles.form}>
          <label>E-mail da sua conta<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={ocupado} /></label>
          <button className={styles.primary} disabled={ocupado} type="submit">{ocupado ? "Enviando…" : "Enviar link de recuperação"}</button>
        </form>}
        {etapa === "enviado" && <div className={styles.notice} role="status">Se este e-mail estiver cadastrado, você receberá um link. Confira também o spam e abra o link neste mesmo navegador.</div>}
        {etapa === "redefinir" && <form onSubmit={salvar} className={styles.form}>
          <label>Nova senha<input type="password" autoComplete="new-password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} disabled={ocupado} /></label>
          <label>Confirmar nova senha<input type="password" autoComplete="new-password" minLength={6} required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} disabled={ocupado} /></label>
          <button className={styles.primary} disabled={ocupado} type="submit">{ocupado ? "Salvando…" : "Salvar nova senha"}</button>
        </form>}
        {etapa === "concluido" && <p className={styles.notice} role="status">Sua senha foi atualizada. Escolha o aplicativo e entre com a nova senha.</p>}
        {mensagem && <p className={styles.notice} role="alert">{mensagem}</p>}
        <nav className={styles.links} aria-label="Voltar ao aplicativo">
          <a href={PA_URL}>Entrar no PA</a><a href={LIDER_URL}>Entrar no Líder Metas</a>
        </nav>
        {etapa === "solicitar" && <a className={styles.official} href={RECOVERY_URL}>Página oficial de recuperação</a>}
      </section>
    </main>
  );
}
