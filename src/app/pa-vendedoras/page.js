"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./PAVendedoras.module.css";

function hojeMes() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

function inicioMes(mes) {
  return `${mes}-01`;
}

function fimMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return `${ano}-${String(numeroMes).padStart(2, "0")}-${String(new Date(ano, numeroMes, 0).getDate()).padStart(2, "0")}`;
}

function formatarData(data) {
  if (!data) return "";
  return data.split("-").reverse().join("/");
}

function formatarPa(valor) {
  return Number(valor || 0).toFixed(2).replace(".", ",");
}

function nomeExibicao(item) {
  return item?.numero_athos ? `${item.nome} (${item.numero_athos})` : item?.nome || "Vendedora";
}

function textoPremiacao(valor) {
  if (valor == null) return "Aguardando último dia";
  const numero = Number(valor || 0);
  return numero > 0 ? `R$ ${numero}` : "Sem premiação";
}

export default function PAVendedoras() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [sessao, setSessao] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [mes, setMes] = useState(hojeMes());
  const [resumos, setResumos] = useState([]);
  const [vendedora, setVendedora] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [loja, setLoja] = useState(null);
  const [detalhes, setDetalhes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const permitido = Boolean(perfil?.ativo) && ["admin", "gestora"].includes(perfil?.papel);

  useEffect(() => {
    let ativo = true;

    async function iniciar() {
      const { data } = await supabase.auth.getSession();
      const novaSessao = data.session;
      if (!ativo) return;
      setSessao(novaSessao);

      if (!novaSessao) {
        setCarregando(false);
        return;
      }

      const { data: perfilResp, error } = await supabase
        .from("perfis")
        .select("papel,ativo")
        .eq("id", novaSessao.user.id)
        .maybeSingle();

      if (!ativo) return;
      if (error) setErro(error.message);
      setPerfil(perfilResp);
      setCarregando(false);
    }

    iniciar();

    return () => {
      ativo = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!sessao || !permitido) return undefined;
    let cancelado = false;

    async function carregarResumo() {
      setCarregando(true);
      setErro("");
      setVendedora(null);
      setLoja(null);
      setLojas([]);
      setDetalhes([]);

      const { data, error } = await supabase
        .from("resumo_pa_mensal")
        .select("*")
        .eq("mes", inicioMes(mes))
        .order("nome", { ascending: true });

      if (cancelado) return;
      if (error) {
        setErro(error.message);
        setResumos([]);
      } else {
        setResumos(data || []);
      }
      setCarregando(false);
    }

    carregarResumo();
    return () => {
      cancelado = true;
    };
  }, [mes, permitido, sessao, supabase]);

  useEffect(() => {
    if (!vendedora) return undefined;
    let cancelado = false;

    async function carregarLojas() {
      setCarregando(true);
      setErro("");
      setLoja(null);
      setDetalhes([]);

      const { data, error } = await supabase
        .from("resumo_pa_mensal_loja")
        .select("*")
        .eq("usuario_id", vendedora.usuario_id)
        .eq("mes", inicioMes(mes))
        .order("loja_id", { ascending: true });

      if (cancelado) return;
      if (error) {
        setErro(error.message);
        setLojas([]);
      } else {
        setLojas(data || []);
      }
      setCarregando(false);
    }

    carregarLojas();
    return () => {
      cancelado = true;
    };
  }, [mes, supabase, vendedora]);

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
  }, [loja, mes, supabase, vendedora]);

  if (carregando && !sessao) {
    return <main className={styles.page}><div className={styles.center}>Carregando...</div></main>;
  }

  if (!sessao) {
    return (
      <main className={styles.page}>
        <section className={styles.empty}>
          <h1>PA das vendedoras</h1>
          <p>Entre no Líder Metas para acessar esta área.</p>
          <button type="button" onClick={() => router.push("/")}>Voltar para o login</button>
        </section>
      </main>
    );
  }

  if (!permitido) {
    return (
      <main className={styles.page}>
        <section className={styles.empty}>
          <h1>Acesso restrito</h1>
          <p>Esta área é exclusiva da gestão.</p>
          <button type="button" onClick={() => router.push("/")}>Voltar ao Líder Metas</button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <button className={styles.back} type="button" onClick={() => router.push("/")}>← Líder Metas</button>
          <p className={styles.eyebrow}>Conferência de desempenho</p>
          <h1>PA das vendedoras</h1>
          <p className={styles.muted}>Resumo geral, totais por loja e lançamentos diários.</p>
        </div>
        <label className={styles.month}>
          Mês
          <input type="month" value={mes} onChange={(evento) => setMes(evento.target.value)} />
        </label>
      </header>

      {erro && <p className={styles.error}>{erro}</p>}

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
          {resumos.map((item) => (
            <button
              className={`${styles.sellerCard} ${vendedora?.usuario_id === item.usuario_id ? styles.selected : ""}`}
              type="button"
              key={item.usuario_id}
              onClick={() => setVendedora(item)}
            >
              <div className={styles.sellerName}>
                <strong>{nomeExibicao(item)}</strong>
                <span>{textoPremiacao(item.premiacao_prevista)}</span>
              </div>
              <div className={styles.metrics}>
                <span><small>Dias</small><b>{Number(item.dias_validos || 0)}</b></span>
                <span><small>Vendas</small><b>{Number(item.vendas || 0)}</b></span>
                <span><small>Peças</small><b>{Number(item.pecas || 0)}</b></span>
                <span><small>PA</small><b>{formatarPa(item.pa)}</b></span>
              </div>
            </button>
          ))}
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
          <div className={styles.storeGrid}>
            {lojas.map((item) => (
              <button
                type="button"
                className={`${styles.storeCard} ${loja?.loja_id === item.loja_id ? styles.selected : ""}`}
                key={item.loja_id}
                onClick={() => setLoja(item)}
              >
                <strong>{item.loja}</strong>
                <span>{item.loja_nome}</span>
                <div className={styles.storeMetrics}>
                  <b>{Number(item.vendas || 0)} vendas</b>
                  <b>{Number(item.pecas || 0)} peças</b>
                  <b>PA {formatarPa(item.pa)}</b>
                </div>
              </button>
            ))}
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
            <div className={styles.tableHeader}>
              <span>Data</span><span>Vendas</span><span>Peças</span><span>PA</span>
            </div>
            {detalhes.map((item) => (
              <div className={styles.tableRow} key={`${item.dia_id}-${item.loja_id}`}>
                <strong>{formatarData(item.data)}</strong>
                <span>{Number(item.vendas || 0)}</span>
                <span>{Number(item.pecas || 0)}</span>
                <span>{formatarPa(item.pa)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
