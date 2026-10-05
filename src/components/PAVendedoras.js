"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CorrecaoLancamentoPA from "@/components/CorrecaoLancamentoPA";
import AdicionarLancamentoPA from "@/components/AdicionarLancamentoPA";
import RegistrarFeriasPA from "@/components/RegistrarFeriasPA";
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

function formatarDataHora(valor) {
  if (!valor) return "";
  return new Date(valor).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
  const [lojasDisponiveis, setLojasDisponiveis] = useState([]);
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
  const [fechamento, setFechamento] = useState(null);
  const [salvandoFechamento, setSalvandoFechamento] = useState(false);
  const [erroFechamento, setErroFechamento] = useState("");
  const [mensagemFechamento, setMensagemFechamento] = useState("");

  const permitido = Boolean(perfil?.ativo) && ["admin", "gestora"].includes(perfil?.papel);

  useEffect(() => {
    setVendedora(null);
    setLoja(null);
    setLojas([]);
    setDetalhes([]);
    setAprovacoes([]);
    setMensagemCorrecao("");
    setFechamento(null);
    setErroFechamento("");
    setMensagemFechamento("");
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

      const [resumosResp, lojasResp, aprovacoesResp, lojasAtivasResp, fechamentoResp] = await Promise.all([
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
        supabase
          .from("lojas")
          .select("id,codigo,nome,ordem")
          .eq("ativa", true)
          .order("ordem"),
        supabase
          .from("fechamentos_pa")
          .select("mes,fechado_por,fechado_em")
          .eq("mes", inicioMes(mes))
          .maybeSingle(),
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

      if (lojasAtivasResp.error) {
        setErro(lojasAtivasResp.error.message);
        setLojasDisponiveis([]);
      } else {
        setLojasDisponiveis(lojasAtivasResp.data || []);
      }

      if (fechamentoResp.error) {
        setFechamento(null);
        setErroFechamento("O fechamento mensal ainda precisa ser configurado no banco.");
      } else {
        setFechamento(fechamentoResp.data || null);
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

  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const mesPodeSerFechado = mes < mesAtual;
  const mesFechado = Boolean(fechamento);
  const todasAprovadas = resumos.length > 0
    && resumos.every((item) => vendedoraTodaAprovada(item.usuario_id));
  const podeReabrir = perfil?.papel === "admin";

  async function alternarFechamento() {
    if (!sessao || salvandoFechamento) return;

    setErroFechamento("");
    setMensagemFechamento("");

    if (mesFechado) {
      if (!podeReabrir) {
        setErroFechamento("Somente uma administradora pode reabrir um mês fechado.");
        return;
      }

      const confirmou = window.confirm(
        `Reabrir ${mes.split("-").reverse().join("/")}? Os lançamentos desse mês voltarão a permitir alterações.`,
      );
      if (!confirmou) return;

      setSalvandoFechamento(true);
      const { error } = await supabase.rpc("reabrir_mes_pa", {
        p_mes: inicioMes(mes),
      });
      setSalvandoFechamento(false);

      if (error) {
        setErroFechamento(error.message || "Não foi possível reabrir o mês.");
        return;
      }

      setMensagemFechamento("Mês reaberto. Os lançamentos podem ser alterados novamente.");
      setRevisao((valor) => valor + 1);
      return;
    }

    if (!mesPodeSerFechado) {
      setErroFechamento("O mês só pode ser fechado depois que terminar.");
      return;
    }

    if (!todasAprovadas) {
      setErroFechamento("Aprove todos os lançamentos por loja antes de fechar o mês.");
      return;
    }

    const confirmou = window.confirm(
      `Fechar ${mes.split("-").reverse().join("/")}? Depois disso, lançamentos, correções, remoções, férias e aprovações desse mês ficarão bloqueados.`,
    );
    if (!confirmou) return;

    setSalvandoFechamento(true);
    const { error } = await supabase.rpc("fechar_mes_pa", {
      p_mes: inicioMes(mes),
    });
    setSalvandoFechamento(false);

    if (error) {
      setErroFechamento(error.message || "Não foi possível fechar o mês.");
      return;
    }

    setMensagemFechamento("Mês fechado com sucesso.");
    setVendedora(null);
    setLoja(null);
    setDetalhes([]);
    setRevisao((valor) => valor + 1);
  }

  async function alternarAprovacao(item) {
    if (!sessao || !vendedora || erroAprovacao || mesFechado) return;

    const aprovada = estaAprovada(item.loja_id);
    setSalvandoAprovacao(item.loja_id);
    setMensagemAprovacao("");

    if (aprovada) {
      const confirmou = window.confirm(`Desfazer a aprovação dos lançamentos de ${item.loja}?`);
      if (!confirmou) {
        setSalvandoAprovacao(null);
        return;
      }

      const { data: removida, error } = await supabase
        .from("conferencias_pa")
        .delete()
        .eq("usuario_id", vendedora.usuario_id)
        .eq("mes", inicioMes(mes))
        .eq("loja_id", item.loja_id)
        .select("usuario_id,mes,loja_id")
        .maybeSingle();

      if (error || !removida) {
        setErroAprovacao(error?.message || "A remoção não foi confirmada. Atualize a página e tente novamente.");
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

        {(mesFechado || mesPodeSerFechado) && (
          <div className={styles.monthClosing}>
            {mesFechado && <span className={styles.closedBadge}>✓ Mês fechado</span>}

            {!mesFechado && mesPodeSerFechado && (
              <button
                type="button"
                className={styles.closeMonthButton}
                onClick={alternarFechamento}
                disabled={salvandoFechamento || carregando || !todasAprovadas || Boolean(erroFechamento)}
                title={!todasAprovadas ? "Aprove todas as lojas antes de fechar o mês." : undefined}
              >
                {salvandoFechamento ? "Fechando..." : "Fechar mês"}
              </button>
            )}

            {mesFechado && podeReabrir && (
              <button
                type="button"
                className={styles.reopenMonthButton}
                onClick={alternarFechamento}
                disabled={salvandoFechamento}
              >
                {salvandoFechamento ? "Reabrindo..." : "Reabrir mês"}
              </button>
            )}
          </div>
        )}
      </header>

      {erro && <p className={styles.error}>{erro}</p>}
      {erroFechamento && <p className={styles.approvalWarning} role="alert">{erroFechamento}</p>}
      {mensagemFechamento && <p className={styles.approvalMessage} role="status">{mensagemFechamento}</p>}
      {mesFechado && (
        <p className={styles.lockNotice}>
          Fechado em {formatarDataHora(fechamento.fechado_em)}. Este mês está somente para consulta; alterações de PA ficam bloqueadas.
        </p>
      )}
      {!mesFechado && mesPodeSerFechado && resumos.length > 0 && !todasAprovadas && !carregando && (
        <p className={styles.monthHint}>Aprove todas as lojas das vendedoras para liberar o fechamento do mês.</p>
      )}
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

          {!mesFechado && (
            <>
              <AdicionarLancamentoPA
                vendedora={vendedora}
                mes={mes}
                lojas={lojasDisponiveis}
                supabase={supabase}
                onSalvou={({ data, loja: codigoLoja }) => {
                  const dataFormatada = data.split("-").reverse().join("/");
                  setMensagemCorrecao(`Lançamento de ${dataFormatada} · ${codigoLoja} adicionado e já disponível no PA da vendedora.`);
                  setLoja(null);
                  setDetalhes([]);
                  setRevisao((valor) => valor + 1);
                }}
              />

              <RegistrarFeriasPA
                vendedora={vendedora}
                supabase={supabase}
                onSalvou={({ inicio, fim, dias, lancamentosRemovidos }) => {
                  const inicioFormatado = inicio.split("-").reverse().join("/");
                  const fimFormatado = fim.split("-").reverse().join("/");
                  const removidos = lancamentosRemovidos > 0
                    ? ` ${lancamentosRemovidos} lançamento${lancamentosRemovidos === 1 ? "" : "s"} do período ${lancamentosRemovidos === 1 ? "foi removido" : "foram removidos"}.`
                    : "";
                  setMensagemCorrecao(
                    `Férias registradas de ${inicioFormatado} a ${fimFormatado} (${dias} dia${dias === 1 ? "" : "s"}).${removidos}`,
                  );
                  setLoja(null);
                  setDetalhes([]);
                  setRevisao((valor) => valor + 1);
                }}
              />
            </>
          )}

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
                    disabled={mesFechado || salvando || carregando || Boolean(erroAprovacao)}
                  >
                    {mesFechado ? "Mês fechado" : salvando ? "Salvando..." : aprovada ? "✓ Aprovado" : "Aprovar lançamentos"}
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
              <CorrecaoLancamentoPA key={`${item.dia_id}-${item.loja_id}`} item={item} supabase={supabase} bloqueado={mesFechado}
                onSalvou={() => {
                  setMensagemCorrecao("Correção salva e aviso registrado no PA da vendedora. Confira os totais atualizados antes de aprovar novamente.");
                  setRevisao((valor) => valor + 1);
                }}
                onRemoveu={() => {
                  setMensagemCorrecao("Lançamento removido e aviso registrado no PA da vendedora. Confira os totais atualizados antes de aprovar novamente.");
                  setLoja(null);
                  setDetalhes([]);
                  setRevisao((valor) => valor + 1);
                }} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
