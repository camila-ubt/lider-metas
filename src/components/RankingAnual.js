"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./RankingAnual.module.css";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const PERIODOS = ["manha","noite"];
const STATUS = { mega: "Mega", super: "Super", meta: "Meta", abaixo: "Abaixo", parcial: "Parcial", semMeta: "Sem meta", futuro: "Futuro" };
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const chave = (loja, mes, periodo) => [loja, mes, periodo].join(":");

function agregar(vendas, metas) {
  const mapa = new Map();
  function obter(loja, mes, periodo) {
    const id = chave(loja, mes, periodo);
    if (!mapa.has(id)) mapa.set(id, { vendido: 0, meta: 0, configurada: false });
    return mapa.get(id);
  }
  for (const venda of vendas) {
    const mes = Number(String(venda.data).slice(5, 7));
    if (mes >= 1 && mes <= 12 && PERIODOS.includes(venda.periodo)) {
      obter(venda.loja_id, mes, venda.periodo).vendido += Number(venda.valor_vendido || 0);
    }
  }
  for (const registro of metas) {
    const mes = Number(String(registro.mes).slice(5, 7));
    const meta = Number(registro.valor_meta || 0);
    if (mes >= 1 && mes <= 12 && PERIODOS.includes(registro.periodo) && meta > 0) {
      const item = obter(registro.loja_id, mes, registro.periodo);
      item.meta += meta;
      item.configurada = true;
    }
  }
  return mapa;
}

function StatusCelula({ resultado, titulo, aoAbrir }) {
  if (resultado.nivel === "futuro") return <span className={styles.futuro}>—</span>;
  if (resultado.nivel === "semMeta") return <span className={styles.semMeta}>Sem meta</span>;
  return (
    <button type="button" onClick={aoAbrir} className={styles.celula + " " + styles[resultado.nivel]}
      aria-label={titulo + ": " + resultado.percentual.toFixed(1) + "%, " + STATUS[resultado.nivel] + ". Ver valores"}>
      <b>{resultado.percentual.toFixed(1)}%</b><small>{STATUS[resultado.nivel]}</small>
    </button>
  );
}

export default function RankingAnual() {
  const supabase = useMemo(() => createClient(), []);
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [tipo, setTipo] = useState("lojas");
  const [lojaFiltro, setLojaFiltro] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [metas, setMetas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setLoading(true);
      setErro("");
      setDetalhe(null);
      const inicio = ano + "-01-01";
      const fim = ano + "-12-31";
      try {
        const [lr, mr] = await Promise.all([
          supabase.from("lojas").select("id,codigo,nome").order("ordem"),
          supabase.from("metas_mensais").select("mes,loja_id,periodo,valor_meta").gte("mes", inicio).lte("mes", fim),
        ]);
        if (lr.error) throw lr.error;
        if (mr.error) throw mr.error;
        const todas = [];
        // Busca o ano por páginas para não truncar a série histórica no limite da API.
        for (let offset = 0; ; offset += 1000) {
          const vr = await supabase.from("vendas_diarias")
            .select("id,data,loja_id,periodo,valor_vendido")
            .gte("data", inicio).lte("data", fim)
            .order("id", { ascending: true })
            .range(offset, offset + 999);
          if (vr.error) throw vr.error;
          const pagina = vr.data || [];
          todas.push(...pagina);
          if (pagina.length < 1000) break;
        }
        if (ativo) {
          setLojas(lr.data || []);
          setMetas(mr.data || []);
          setVendas(todas);
        }
      } catch (error) {
        console.error("Ranking anual", error);
        if (ativo) setErro("Não foi possível consultar os resultados anuais.");
      } finally {
        if (ativo) setLoading(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [supabase, ano]);

  const dados = useMemo(() => agregar(vendas, metas), [vendas, metas]);
  const lojasOrdenadas = useMemo(
    () => [...lojas].sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || ""), "pt-BR")),
    [lojas]
  );
  const lojaSelecionada = lojasOrdenadas.find((item) => String(item.id) === lojaFiltro) || lojasOrdenadas[0];

  function resultado(loja, mes, periodo) {
    const registros = (periodo ? [periodo] : PERIODOS).map((p) => dados.get(chave(loja.id, mes, p)));
    const vendido = registros.reduce((s, r) => s + (r?.vendido || 0), 0);
    const meta = registros.reduce((s, r) => s + (r?.meta || 0), 0);
    const configurada = registros.every((r) => Boolean(r?.configurada));
    const percentual = configurada && meta > 0 ? vendido / meta * 100 : null;
    const futuro = ano > hoje.getFullYear() || ano === hoje.getFullYear() && mes > hoje.getMonth() + 1;
    const atual = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
    const nivel = futuro ? "futuro" : percentual === null ? "semMeta" : atual ? "parcial" :
      percentual >= 130 ? "mega" : percentual >= 120 ? "super" : percentual >= 100 ? "meta" : "abaixo";
    return { vendido, meta, configurada, percentual, nivel };
  }

  const ranking = lojasOrdenadas.map((loja) => {
    const meses = MESES.map((_, i) => ({ mes: i + 1, ...resultado(loja, i + 1) }))
      .filter((r) => !["parcial", "futuro", "semMeta"].includes(r.nivel));
    const batidos = meses.filter((r) => ["meta", "super", "mega"].includes(r.nivel)).length;
    const melhor = [...meses].sort((a, b) => b.percentual - a.percentual)[0];
    const pior = [...meses].sort((a, b) => a.percentual - b.percentual)[0];
    return { loja, meses: meses.length, batidos, taxa: meses.length ? batidos / meses.length : -1, melhor, pior };
  }).sort((a, b) => b.taxa - a.taxa || b.batidos - a.batidos);

  return (
    <section className={styles.area} aria-label="Ranking anual">
      <div className={styles.cabecalho}>
        <div><p className="eyebrow">Visão histórica</p><h2>Ranking anual</h2>
          <p className="muted">Compare os meses das três lojas e seus períodos.</p></div>
        <label>Ano
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {Array.from({ length: hoje.getFullYear() - 2024 + 1 }, (_, i) => hoje.getFullYear() - i)
              .map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.abas} role="group" aria-label="Tipo de comparação">
        <button className={tipo === "lojas" ? styles.ativo : ""} aria-pressed={tipo === "lojas"}
          type="button" onClick={() => setTipo("lojas")}>Lojas</button>
        <button className={tipo === "turnos" ? styles.ativo : ""} aria-pressed={tipo === "turnos"}
          type="button" onClick={() => setTipo("turnos")}>Turnos</button>
      </div>
      <div className={styles.legenda}>{["abaixo","meta","super","mega","parcial","semMeta"].map((s) =>
        <span key={s}><i className={styles[s]} />{STATUS[s]}</span>)}</div>
      {loading ? <p role="status" className={styles.aviso}>Carregando {ano}...</p>
        : erro ? <p role="alert" className={styles.aviso}>{erro}</p>
        : !lojasOrdenadas.length ? <p className={styles.aviso}>Sem lojas disponíveis.</p>
        : <>
          {tipo === "lojas" ? <>
            <div className={styles.resumos}>
              {ranking.map((r, i) => <article key={r.loja.id} className={styles.resumo}>
                <h3>{i + 1}º · {r.loja.codigo || r.loja.nome}</h3>
                <strong>{r.meses ? r.batidos + "/" + r.meses : "—"}</strong>
                <small>meses com meta atingida</small>
                {r.melhor && <p>Melhor: {MESES[r.melhor.mes - 1].slice(0, 3)} · {r.melhor.percentual.toFixed(1)}%</p>}
                {r.pior && <p>Menor: {MESES[r.pior.mes - 1].slice(0, 3)} · {r.pior.percentual.toFixed(1)}%</p>}
              </article>)}
            </div>
            <div className={styles.painel}>
              <h3>Desempenho por mês</h3>
              <div className={styles.scroll}><table>
                <thead><tr><th scope="col">Mês</th>{lojasOrdenadas.map((l) =>
                  <th scope="col" key={l.id}>{l.codigo || l.nome}</th>)}</tr></thead>
                <tbody>{MESES.map((nome, i) => <tr key={nome}>
                  <th scope="row">{nome.slice(0, 3)}</th>
                  {lojasOrdenadas.map((l) => <td key={l.id}>
                    <StatusCelula resultado={resultado(l, i + 1)} titulo={nome + " " + l.nome}
                      aoAbrir={() => setDetalhe(i + 1)} />
                  </td>)}
                </tr>)}</tbody>
              </table></div>
            </div>
          </> : <div className={styles.painel}>
            <div className={styles.cabecalho}><h3>Manhã × Noite</h3>
              <label>Loja
                <select value={String(lojaSelecionada.id)} onChange={(e) => setLojaFiltro(e.target.value)}>
                  {lojasOrdenadas.map((l) =>
                    <option key={l.id} value={l.id}>{l.codigo} · {l.nome}</option>)}
                </select>
              </label>
            </div>
            <div className={styles.scroll}><table>
              <thead><tr><th scope="col">Mês</th><th scope="col">Manhã</th><th scope="col">Noite</th></tr></thead>
              <tbody>{MESES.map((nome, i) => <tr key={nome}>
                <th scope="row">{nome.slice(0, 3)}</th>
                {PERIODOS.map((p) => <td key={p}>
                  <StatusCelula resultado={resultado(lojaSelecionada, i + 1, p)}
                    titulo={nome + " " + lojaSelecionada.nome + " " + p} aoAbrir={() => setDetalhe(i + 1)} />
                </td>)}
              </tr>)}</tbody>
            </table></div>
          </div>}
          {detalhe && <div className={styles.painel}>
            <div className={styles.cabecalho}><h3>{MESES[detalhe - 1]} de {ano}</h3>
              <button type="button" className={styles.fechar} onClick={() => setDetalhe(null)}>Fechar</button>
            </div>
            <div className={styles.detalhes}>
              {lojasOrdenadas.map((l) => {
                const r = resultado(l, detalhe);
                return <article key={l.id}>
                  <h4>{l.codigo} · {l.nome}</h4>
                  <p>Vendido: <b>{moeda.format(r.vendido)}</b></p>
                  <p>Meta: {r.configurada ? moeda.format(r.meta) : "Sem meta completa"}</p>
                  {PERIODOS.map((p) => {
                    const t = resultado(l, detalhe, p);
                    return <p key={p}>{p === "manha" ? "Manhã" : "Noite"}: {moeda.format(t.vendido)} / {t.configurada ? moeda.format(t.meta) : "Sem meta"}</p>;
                  })}
                </article>;
              })}
            </div>
          </div>}
          <p className={styles.nota}>Meta 100% · Supermeta 120% · Megameta 130%. Mês atual aparece como parcial e não entra na classificação; sem meta completa, o mês fica sem classificação.</p>
        </>}
    </section>
  );
}
