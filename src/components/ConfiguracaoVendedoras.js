"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

export default function ConfiguracaoVendedoras() {
  const supabase = useMemo(() => createClient(), []);
  const [admin, setAdmin] = useState(false);
  const [aberta, setAberta] = useState(false);
  const [alvos, setAlvos] = useState({ tabs: null, app: null });
  const [vendedoras, setVendedoras] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [alterando, setAlterando] = useState("");
  const [mensagem, setMensagem] = useState("");

  const localizarAlvos = useCallback(() => {
    const tabs = document.querySelector(".app-shell .tabs");
    const app = document.querySelector(".app-shell");
    setAlvos((atual) =>
      atual.tabs === tabs && atual.app === app ? atual : { tabs, app }
    );
  }, []);

  const verificarAdmin = useCallback(async () => {
    const { data: sessao } = await supabase.auth.getSession();
    const id = sessao.session?.user?.id;
    if (!id) {
      setAdmin(false);
      return;
    }

    const { data } = await supabase
      .from("perfis")
      .select("papel,ativo")
      .eq("id", id)
      .maybeSingle();
    setAdmin(Boolean(data?.ativo && data?.papel === "admin"));
  }, [supabase]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setMensagem("");

    const [perfisResp, paResp] = await Promise.all([
      supabase
        .from("perfis")
        .select("id,nome,papel,ativo,criado_em")
        .eq("papel", "vendedora")
        .order("ativo", { ascending: true })
        .order("criado_em", { ascending: false }),
      supabase
        .from("usuarios_pa")
        .select("id,numero_athos,ativo")
        .eq("tipo_usuario", "vendedora"),
    ]);

    const erro = perfisResp.error || paResp.error;
    if (erro) {
      setMensagem(erro.message);
      setCarregando(false);
      return;
    }

    const paPorId = new Map((paResp.data || []).map((item) => [item.id, item]));
    setVendedoras(
      (perfisResp.data || []).map((item) => ({
        ...item,
        numero_athos: paPorId.get(item.id)?.numero_athos ?? null,
        pa_ativo: paPorId.get(item.id)?.ativo ?? item.ativo,
      }))
    );
    setCarregando(false);
  }, [supabase]);

  useEffect(() => {
    localizarAlvos();
    verificarAdmin();
    const observer = new MutationObserver(localizarAlvos);
    observer.observe(document.body, { childList: true, subtree: true });

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      verificarAdmin();
      localizarAlvos();
    });

    return () => {
      observer.disconnect();
      listener.subscription.unsubscribe();
    };
  }, [localizarAlvos, supabase, verificarAdmin]);

  useEffect(() => {
    if (!alvos.tabs) return undefined;

    function aoClicarNasAbas(evento) {
      const botao = evento.target.closest("button");
      if (!botao || !alvos.tabs.contains(botao)) return;
      if (botao.hasAttribute("data-config-vendedoras-botao")) return;
      setAberta(false);
    }

    alvos.tabs.addEventListener("click", aoClicarNasAbas);
    return () => alvos.tabs?.removeEventListener("click", aoClicarNasAbas);
  }, [alvos.tabs]);

  useEffect(() => {
    if (aberta && admin) carregar();
  }, [aberta, admin, carregar]);

  useEffect(() => {
    if (!alvos.app || !alvos.tabs) return undefined;

    alvos.app.classList.toggle("config-vendedoras-aberta", aberta && admin);

    const outrosBotoes = [...alvos.tabs.querySelectorAll("button:not([data-config-vendedoras-botao])")];
    if (aberta && admin) {
      outrosBotoes.forEach((botao) => {
        botao.dataset.configVendedorasActiveAnterior = botao.classList.contains("active") ? "true" : "false";
        botao.dataset.configVendedorasPressedAnterior = botao.getAttribute("aria-pressed") ?? "";
        botao.classList.remove("active");
        if (botao.hasAttribute("aria-pressed")) botao.setAttribute("aria-pressed", "false");
      });
    }

    return () => {
      alvos.app?.classList.remove("config-vendedoras-aberta");
      outrosBotoes.forEach((botao) => {
        if (botao.dataset.configVendedorasActiveAnterior === "true") botao.classList.add("active");
        if (botao.dataset.configVendedorasPressedAnterior !== undefined) {
          const anterior = botao.dataset.configVendedorasPressedAnterior;
          if (anterior) botao.setAttribute("aria-pressed", anterior);
          delete botao.dataset.configVendedorasPressedAnterior;
        }
        delete botao.dataset.configVendedorasActiveAnterior;
      });
    };
  }, [aberta, admin, alvos.app, alvos.tabs]);

  async function alterarStatus(vendedora, ativo) {
    setAlterando(vendedora.id);
    setMensagem("");

    const perfilResp = await supabase
      .from("perfis")
      .update({ ativo })
      .eq("id", vendedora.id)
      .eq("papel", "vendedora");

    if (perfilResp.error) {
      setMensagem(perfilResp.error.message);
      setAlterando("");
      return;
    }

    const paResp = await supabase
      .from("usuarios_pa")
      .update({ ativo })
      .eq("id", vendedora.id)
      .eq("tipo_usuario", "vendedora");

    if (paResp.error) {
      await supabase.from("perfis").update({ ativo: !ativo }).eq("id", vendedora.id);
      setMensagem(`Não foi possível atualizar o acesso ao PA: ${paResp.error.message}`);
      setAlterando("");
      return;
    }

    setMensagem(
      ativo
        ? `${vendedora.nome} foi aprovada e está com o perfil ativo.`
        : `${vendedora.nome} foi desativada. O histórico foi preservado.`
    );
    await carregar();
    setAlterando("");
  }

  if (!admin || !alvos.tabs || !alvos.app) return null;

  const pendentes = vendedoras.filter((item) => !item.ativo).length;
  const ativas = vendedoras.filter((item) => item.ativo).length;

  return (
    <>
      {createPortal(
        <button
          type="button"
          data-config-vendedoras-botao
          className={aberta ? "active" : ""}
          aria-pressed={aberta}
          onClick={() => setAberta(true)}
        >
          Vendedoras{pendentes > 0 ? ` (${pendentes})` : ""}
        </button>,
        alvos.tabs
      )}

      {aberta && createPortal(
        <section className="config-vendedoras-portal" aria-label="Configuração das vendedoras">
          <div className="panel config-vendedoras-panel">
            <div className="config-vendedoras-cabecalho">
              <div>
                <p className="eyebrow">Acessos do PA</p>
                <h2>Configuração das vendedoras</h2>
                <p className="muted">Aprove novos cadastros e ative ou desative o acesso sem apagar o histórico.</p>
              </div>
              <button type="button" className="secondary-button" onClick={carregar}>Atualizar</button>
            </div>

            <div className="config-vendedoras-resumo">
              <div><strong>{pendentes}</strong><span>Aguardando aprovação</span></div>
              <div><strong>{ativas}</strong><span>Perfis ativos</span></div>
              <div><strong>{vendedoras.length}</strong><span>Total de vendedoras</span></div>
            </div>

            {mensagem && <p className="message">{mensagem}</p>}
            {carregando && <p className="muted">Atualizando vendedoras...</p>}

            {!carregando && vendedoras.length === 0 && (
              <div className="config-vendedoras-vazio">Nenhuma vendedora cadastrada.</div>
            )}

            <div className="config-vendedoras-lista">
              {vendedoras.map((vendedora) => {
                const ativa = Boolean(vendedora.ativo && vendedora.pa_ativo);
                return (
                  <article className={`config-vendedora-card ${ativa ? "is-active" : "is-pending"}`} key={vendedora.id}>
                    <div className="config-vendedora-info">
                      <div className="config-vendedora-nome">
                        <strong>{vendedora.nome}</strong>
                        <span className={`config-vendedora-status ${ativa ? "ativo" : "pendente"}`}>
                          {ativa ? "Ativa" : "Aguardando aprovação"}
                        </span>
                      </div>
                      <span>Nº Athos: {vendedora.numero_athos ?? "não informado"}</span>
                      <small>Cadastro: {new Date(vendedora.criado_em).toLocaleDateString("pt-BR")}</small>
                    </div>
                    <button
                      type="button"
                      className={ativa ? "secondary-button danger-button" : "primary-button"}
                      disabled={alterando === vendedora.id}
                      onClick={() => alterarStatus(vendedora, !ativa)}
                    >
                      {alterando === vendedora.id
                        ? "Salvando..."
                        : ativa
                          ? "Desativar perfil"
                          : "Aprovar e ativar"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>,
        alvos.app
      )}
    </>
  );
}
