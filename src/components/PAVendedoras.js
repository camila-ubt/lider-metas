"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CorrecaoLancamentoPA from "@/components/CorrecaoLancamentoPA";
import styles from "@/app/pa-vendedoras/PAVendedoras.module.css";

function inicioMes(mes) {
  return `${mes}-01`;
}

function fimMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return `${ano}-${String(numeroMes).padStart(2, "0")}-${String(new Date(ano, numeroMes, 0).getDate()).padStart(2, "0")}`;
}

function formatarPa(valor) {
  return Number(valor || 0).toFixed(2).replace(".", ",");
}

function nomeExibicao(item) {
  const nome = item?.nome || "Vendedora";
  return item?.numero_athos ? `${item.numero_athos} — ${nome}` : nome;
}

function compararVendedoras(a, b) {
  const numeroA = Number(a.numero_athos) || Infinity;
  const numeroB = Number(b.numero_athos) || Infinity;
  return numeroA - numeroB || (a.nome || "").localeCompare(b.nome || "", "pt-BR");
}

function textoPremiacao(valor) {
  if (valor == null) return "Aguardando último dia";
  const numero = Number(valor || 0);
  return numero > 0 ? `R$ ${numero}` : "Sem premiação";
}

export default function PAVendedoras({ mes, sessao, perfil }) {
  const supabase = useMemo(() => createClient(), []);
  const [resumos, setResumos] = useState([]);
  const [lojasDoMes, setLojasDoMes] = useState([]);
  const [aprovacoesDoMes, setAprovacoesDoMes] = useState([]);
  const [vendedora, setVendedora] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [loja, setLoja] = useState(null);
  const [detalhes, setDetalhes] = useState([]);
  const [aprovacoes, setAprovacoes] = useState([]);
  const [salvandoAprovacao, setSalvandoAprovacao] = useState(null);
  const [erroAprovacao, setErroAprovacao] = useState("");
  const [mensagemAprovacao, setMensagemAprovacao] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [revisao, setRevisao] = useState(0);
  const [mensagemCorrecao, setMensagemCorrecao] = useState("");

  const permitido = Boolean(perfil?.ativo) && ["admin", "gestora"].includes(perfil?.papel);

  useEffect(() => {
    setVendedora(null);
    setLoja(null);
    setLojas([]);
    setDetalhes([]);
    setAprovacoes([]);
    setMensagemCorrecao("");
  }, [mes, sessao]);

  useEffect(() => {
    if (!sessao || !permitido) return undefined;
    let cancelado = false;

    async function carregarResumo() {
      setCarregando(true);
      setErro("");
      setErroAprovacao("");
      setMensagemAprovacao("");
      setLojasDoMes([]);
      setAprovacoesDoMes([]);

      const [resumosResp, lojasResp, aprovacoesResp] = await Promise.all([
        supabase
          .from("resumo_pa_mensal")
          .select("*")
          .eq("mes", inicioMes(mes))
          .order("nome", { ascending: true }),
        supabase
          .from("resumo_pa_mensal_loja")
          .select("usuario_id,loja_id")
          .eq("mes", inicioMes(mes)),
        supabase
          .from("conferencias_pa")
          .select("usuario_id,mes,loja_id,aprovado_por,aprovado_em")
          .eq("mes", inicioMes(mes)),
      ]);

      if (cancelado) return;

      if (resumosResp.error) {
        setErro(resumosResp.error.message);
        setResumos([]);
      } else {
        setResumos([...(resumosResp.data || [])].sort(compararVendedoras));
      }

      if (lojasResp.error) {
        setErro(lojasResp.error.message);
        setLojasDoMes([]);
      } else {
        setLojasDoMes(lojasResp.data || []);
      }

      if (aprovacoesResp.error) {
        setErroAprovacao("A aprovação por loja ainda precisa ser configurada no banco.");
        setAprovacoesDoMes([]);
      } else {
        setAprovacoesDoMes(aprovacoesResp.data || []);
      }

      setCarregando(false);
    }

    carregarResumo();
    return () => {
      cancelado = true;
    };
  }, [mes, permitido, sessao, supabase, revisao]);

  useEffect(() => {
    if (!vendedora) return undefined;
    let cancelado = false;

    async function carregarLojas() {
      setCarregando(true);
      setErro("");
      setErroAprovacao("");
      setMensagemAprovacao("");

      const [lojasResp, aprovacoesResp] = await Promise.all([
        supabase
          .from("resumo_pa_mensal_loja")
          .select("*")
          .eq("usuario_id", vendedora.usuario_id)
          .eq("mes", inicioMes(mes))
          .order("loja_id", { ascending: true }),
        supabase
          .from("conferencias_pa")
          .select("usuario_id,mes,loja_id,aprovado_por,aprovado_em")
          .eq("usuario_id", vendedora.usuario_id)
          .eq("mes", inicioMes(mes)),
      ]);

      if (cancelado) return;

      if (lojasResp.error) {
        setErro(lojasResp.error.message);
        setLojas([]);
      } else {
        setLojas(lojasResp.data || []);
      }

      if (aprovacoesResp.error) {
        setErroAprovacao("A aprovação por loja ainda precisa ser configurada no banco.");
        setAprovacoes([]);
      } else {
        setAprovacoes(aprovacoesResp.data || []);
      }

      setCarregando(false);
    }

    carregarLojas();
    return () => {
      cancelado = true;
    };
  }, [mes, supabase, vendedora, revisao]);

  useEffect(() => {
    if (!vendedora || !loja) return undefined;
    let cancelado = false;

    async function carregarDetalhes() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("detalhes_pa_diarios")
        .select("*")
        .eq("usuario_id", vendedora.usuario_id)
        .eq("loja_id", loja.loja_id)
        .gte("data", inicioMes(mes))
        .lte("data", fimMes(mes))
        .order("data", { ascending: true });

      if (cancelado) return;
      if (error) {
        setErro(error.message);
        setDetalhes([]);
      } else {
        setDetalhes(data || []);
      }
      setCarregando(false);
    }

    carregarDetalhes();
    return () => {
      cancelado = true;
    };
  }, [loja, mes, supabase, vendedora, revisao]);

  function estaAprovada(lojaId) {
    return aprovacoes.some((item) => Number(item.loja_id) === Number(lojaId));
  }

  function vendedoraTodaAprovada(usuarioId) {
    const lojasDaVendedora = lojasDoMes.filter((item) => item.usuario_id === usuarioId);
    if (lojasDaVendedora.length === 0) return false;

    return lojasDaVendedora.every((lojaResumo) =>
      aprovacoesDoMes.some(
        (aprovacao) =>
          aprovacao.usuario_id === usuarioId
          && Number(aprovacao.loja_id) === Number(lojaResumo.loja_id),
      ),
    );
  }

  async function alternarAprovacao(item) {
    if (!sessao || !vendedora || erroAprovacao) return;

    const aprovada = estaAprovada(item.loja_id);
    setSalvandoAprovacao(item.loja_id);
    setMensagemAprovacao("");

    if (aprovada) {
      const confirmou = window.confirm(`Desfazer a aprovação dos lançamentos de ${item.loja}?`);
      if (!confirmou) {
        setSalvandoAprovacao(null);
        return;
      }

      const { error } = await supabase
        .from("conferencias_pa")
        .delete()
        .eq("usuario_id", vendedora.usuario_id)
        .eq("mes", inicioMes(mes))
        .eq("loja_id", item.loja_id);

      if (error) {
        setErroAprovacao(error.message);
      } else {
        setAprovacoes((atuais) => atuais.filter((registro) => Number(registro.loja_id) !== Number(item.loja_id)));
        setAprovacoesDoMes((atuais) => atuais.filter(
          (registro) => !(
            registro.usuario_id === vendedora.usuario_id
            && Number(registro.loja_id) === Number(item.loja_id)
          ),
        ));
        setMensagemAprovacao(`${item.loja}: aprovação removida.`);
      }
      setSalvandoAprovacao(null);
      return;
    }

    const { data, error } = await supabase
      .from("conferencias_pa")
      .upsert(
        {
          usuario_id: vendedora.usuario_id,
          mes: inicioMes(mes),
          loja_id: Number(item.loja_id),
          aprovado_por: sessao.user.id,
          aprovado_em: new Date().toISOString(),
        },
        { onConflict: "usuario_id,mes,loja_id" },
      )
      .select("usuario_id,mes,loja_id,aprovado_por,aprovado_em")
      .single();

    if (error) {
      setErroAprovacao(error.message);
    } else {
      setAprovacoes((atuais) => [
        ...atuais.filter((registro) => Number(registro.loja_id) !== Number(item.loja_id)),
        data,
      ]);
      setAprovacoesDoMes((atuais) => [
        ...atuais.filter((registro) => !(
          registro.usuario_id === vendedora.usuario_id
          && Number(registro.loja_id) === Number(item.loja_id)
        )),
        data,
      ]);
      setMensagemAprovacao(`${item.loja}: lançamentos aprovados.`);
    }
    setSalvandoAprovacao(null);
  }

  if (!sessao || !permitido) {
    return (
      <section className={styles.empty}>
        <h2>Acesso restrito</h2>
        <p>Esta área é exclusiva da gestão.</p>
      </section>
    );
  }

  return (
    <section className={styles.embedded} aria-label="PA das vendedoras">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Conferência de desempenho</p>
          <h2>PA das vendedoras</h2>
          <p className={styles.muted}>Resumo geral, totais por loja e lançamentos diários.</p>
        </div>
      </header>

      {erro && <p className={styles.error}>{erro}</p>}
      {mensagemCorrecao && <p className={styles.approvalMessage} role="status">{mensagemCorrecao}</p>}

      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <div>
            <p className={styles.eyebrow}>Resumo do mês</p>
            <h2>Vendedoras</h2>
          </div>
          <span>{resumos.length} registro{resumos.length === 1 ? "" : "s"}</span>
        </div>

        {carregando && !vendedora && <p className={styles.muted}>Atualizando dados...</p>}
        {!carregando && resumos.length === 0 && <p className={styles.muted}>Nenhum lançamento de PA neste mês.</p>}

        <div className={styles.sellerList}>
          {resumos.map((item) => {
            const conferida = vendedoraTodaAprovada(item.usuario_id);

            return (
              <button
                className={`${styles.sellerCard} ${vendedora?.usuario_id === item.usuario_id ? styles.selected : ""}`}
                type="button"
                key={item.usuario_id}
                onClick={() => { setVendedora(item); setLoja(null); setDetalhes([]); }}
              >
                <div className={styles.sellerName}>
                  <strong>{conferida ? "✓ " : ""}{nomeExibicao(item)}</strong>
                  <span>{textoPremiacao(item.premiacao_prevista)}</span>
                </div>
                <div className={styles.metrics}>
                  <span><small>Dias</small><b>{Number(item.dias_validos || 0)}</b></span>
                  <span><small>Vendas</small><b>{Number(item.vendas || 0)}</b></span>
                  <span><small>Peças</small><b>{Number(item.pecas || 0)}</b></span>
                  <span><small>PA</small><b>{formatarPa(item.pa)}</b></span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {vendedora && (
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <p className={styles.eyebrow}>{nomeExibicao(vendedora)}</p>
              <h2>Totais por loja</h2>
            </div>
            <button className={styles.textButton} type="button" onClick={() => setVendedora(null)}>Fechar</button>
          </div>

          {carregando && !loja && <p className={styles.muted}>Carregando lojas...</p>}
          {erroAprovacao && <p className={styles.approvalWarning}>{erroAprovacao}</p>}
          {mensagemAprovacao && <p className={styles.approvalMessage}>{mensagemAprovacao}</p>}

          <div className={styles.storeGrid}>
            {lojas.map((item) => {
              const aprovada = estaAprovada(item.loja_id);
              const salvando = Number(salvandoAprovacao) === Number(item.loja_id);

              return (
                <article
                  className={`${styles.storeCard} ${loja?.loja_id === item.loja_id ? styles.selected : ""} ${aprovada ? styles.approvedStore : ""}`}
                  key={item.loja_id}
                >
                  <button type="button" className={styles.storeMain} onClick={() => setLoja(item)}>
                    <strong>{item.loja}</strong>
                    <span>{item.loja_nome}</span>
                    <div className={styles.storeMetrics}>
                      <b>{Number(item.vendas || 0)} vendas</b>
                      <b>{Number(item.pecas || 0)} peças</b>
                      <b>PA {formatarPa(item.pa)}</b>
                    </div>
                    <small>Ver lançamentos</small>
                  </button>

                  <button
                    type="button"
                    className={`${styles.approveButton} ${aprovada ? styles.approvedButton : ""}`}
                    onClick={() => alternarAprovacao(item)}
                    disabled={salvando || carregando || Boolean(erroAprovacao)}
                  >
                    {salvando ? "Salvando..." : aprovada ? "✓ Aprovado" : "Aprovar lançamentos"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {vendedora && loja && (
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <p className={styles.eyebrow}>{nomeExibicao(vendedora)} · {loja.loja}</p>
              <h2>Detalhamento diário</h2>
            </div>
            <button className={styles.textButton} type="button" onClick={() => setLoja(null)}>Fechar</button>
          </div>

          {carregando && <p className={styles.muted}>Carregando lançamentos...</p>}
          {!carregando && detalhes.length === 0 && <p className={styles.muted}>Nenhum lançamento nesta loja.</p>}

          <div className={styles.table}>
            <div className={`${styles.tableHeader} ${styles.editableRow}`}>
              <span>Data</span><span>Vendas</span><span>Peças</span><span>PA</span><span>Ação</span>
            </div>
            {detalhes.map((item) => (
              <CorrecaoLancamentoPA key={`${item.dia_id}-${item.loja_id}`} item={item} supabase={supabase}
                onSalvou={() => {
                  setMensagemCorrecao("Correção salva e aviso registrado no PA da vendedora. Confira os totais atualizados antes de aprovar novamente.");
                  setRevisao((valor) => valor + 1);
                }} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
