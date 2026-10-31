"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { resumirResultadosMensais } from "@/lib/rankingAnual.mjs";
import { compararVendidoComMeta } from "@/lib/detalheMensalRanking.mjs";
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


function SaldoMeta({ resultado, compacto = false }) {
  const comparacao = compararVendidoComMeta(resultado.vendido, resultado.meta, resultado.configurada);
  if (comparacao.situacao === "semMeta") {
    return <span className={styles.saldoSemMeta}>Meta não configurada</span>;
  }

  const acima = comparacao.situacao === "acima";
  const abaixo = comparacao.situacao === "abaixo";
  const simbolo = acima ? "↑" : abaixo ? "↓" : "✓";
  const valor = (acima ? "+" : abaixo ? "−" : "") + moeda.format(Math.abs(comparacao.diferenca));
  const descricao = acima ? "acima da meta" : abaixo ? "faltam para a meta" : "meta atingida";
  const parcial = resultado.nivel === "parcial";

  return (
    <div className={[
      styles.saldoMeta,
      styles[acima ? "saldoPositivo" : abaixo ? "saldoNegativo" : "saldoAtingido"],
      compacto ? styles.saldoCompacto : "",
    ].filter(Boolean).join(" ")}>
      <span className={styles.saldoSimbolo} aria-hidden="true">{simbolo}</span>
      <strong>{valor}</strong>
      <span>{descricao}{parcial ? " até agora" : ""}</span>
    </div>
  );
}

function DetalheTurno({ nome, resultado }) {
  const comparacao = compararVendidoComMeta(resultado.vendido, resultado.meta, resultado.configurada);
  return (
    <div className={styles.turnoDetalhe}>
      <div className={styles.turnoTopo}>
        <strong>{nome}</strong>
        {comparacao.percentual !== null && (
          <span className={styles.turnoPercentual}>{comparacao.percentual.toFixed(1)}%</span>
        )}
      </div>
      <p className={styles.turnoValores}>
        <span>Vendido <b>{moeda.format(resultado.vendido)}</b></span>
        <span>Meta <b>{resultado.configurada ? moeda.format(resultado.meta) : "—"}</b></span>
      </p>
      <SaldoMeta resultado={resultado} compacto />
    </div>
  );
}

function CartaoDetalheMensal({ titulo, resultado, manha, noite }) {
  const situacao = STATUS[resultado.nivel] || "Sem meta";
  return (
    <article className={styles.cartaoDetalhe + " " + (styles["detalhe" + resultado.nivel] || "")}>
      <header className={styles.detalheTopo}>
        <h4>{titulo}</h4>
        <span className={styles.seloNivel + " " + (styles[resultado.nivel] || "")}>
          {situacao}
          {resultado.percentual !== null && " · " + resultado.percentual.toFixed(1) + "%"}
        </span>
      </header>
      <div className={styles.detalheValores}>
        <div>
          <span>Vendido</span>
          <strong className={styles.valorVendido}>{moeda.format(resultado.vendido)}</strong>
        </div>
        <div>
          <span>Meta</span>
          <strong>{resultado.configurada ? moeda.format(resultado.meta) : "Não configurada"}</strong>
        </div>
      </div>
      <SaldoMeta resultado={resultado} />
      <div className={styles.turnosDetalhe}>
        <DetalheTurno nome="Manhã" resultado={manha} />
        <DetalheTurno nome="Noite" resultado={noite} />
      </div>
    </article>
  );
}

export default function RankingAnual() {
  const supabase = useMemo(() => createClient(), []);
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [tipo, setTipo] = useState("lojas");
  const [lojaFiltro, setLojaFiltro] = useState("geral");
  const [detalhe, setDetalhe] = useState(null);
  const fecharModalRef = useRef(null);

  useEffect(() => {
    if (detalhe === null) return undefined;

    const origem = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fecharModalRef.current?.focus();

    function aoPressionarTecla(evento) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        setDetalhe(null);
      }
      // O modal tem um único controle de ação. O Tab permanece nele.
      if (evento.key === "Tab") {
        evento.preventDefault();
        fecharModalRef.current?.focus();
      }
    }

    document.addEventListener("keydown", aoPressionarTecla);
    return () => {
      document.removeEventListener("keydown", aoPressionarTecla);
      document.body.style.overflow = overflowAnterior;
      if (origem instanceof HTMLElement && origem.isConnected) origem.focus();
    };
  }, [detalhe]);
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

  function consolidar(registros, mes) {
    const vendido = registros.reduce((s, r) => s + (r?.vendido || 0), 0);
    const meta = registros.reduce((s, r) => s + (r?.meta || 0), 0);
    // O geral só recebe classificação se todas as três lojas tiverem meta para o turno.
    const configurada = registros.length > 0 && registros.every((r) => Boolean(r?.configurada));
    const percentual = configurada && meta > 0 ? vendido / meta * 100 : null;
    const futuro = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth() + 1);
    const atual = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
    const nivel = futuro ? "futuro" : percentual === null ? "semMeta" : atual ? "parcial" :
      percentual >= 130 ? "mega" : percentual >= 120 ? "super" : percentual >= 100 ? "meta" : "abaixo";
    return { vendido, meta, configurada, percentual, nivel };
  }

  function resultado(loja, mes, periodo) {
    const registros = (periodo ? [periodo] : PERIODOS).map((p) => dados.get(chave(loja.id, mes, p)));
    return consolidar(registros, mes);
  }

  function resultadoGeral(mes, periodo) {
    const registros = lojasOrdenadas.flatMap((loja) =>
      (periodo ? [periodo] : PERIODOS).map((p) => dados.get(chave(loja.id, mes, p)))
    );
    // Somar valores e metas antes do percentual; não tirar média de % das lojas.
    return consolidar(registros, mes);
  }

  const ranking = lojasOrdenadas.map((loja) => ({
    loja,
    ...resumirResultadosMensais(
      MESES.map((_, i) => ({ mes: i + 1, ...resultado(loja, i + 1) }))
    ),
  })).sort((a, b) => b.taxa - a.taxa || b.batidos - a.batidos);

  // Mesmos critérios das lojas, aplicados ao consolidado ou à loja selecionada.
  const resumosTurnos = lojaSelecionada ? PERIODOS.map((periodo) => {
    const resultados = MESES.map((_, i) => ({
      mes: i + 1,
      ...(lojaFiltro === "geral"
        ? resultadoGeral(i + 1, periodo)
        : resultado(lojaSelecionada, i + 1, periodo)),
    }));
    return { periodo, ...resumirResultadosMensais(resultados) };
  }) : [];

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
          </> : <>
            <div className={styles.resumosTurnos}>
              {resumosTurnos.map((r) => (
                <article className={styles.resumo} key={r.periodo}>
                  <h3>{r.periodo === "manha" ? "Manhã" : "Noite"}</h3>
                  <strong>{r.meses ? r.batidos + "/" + r.meses : "—"}</strong>
                  <small>meses com meta atingida</small>
                  {r.melhor && <p>Melhor: {MESES[r.melhor.mes - 1].slice(0, 3)} · {r.melhor.percentual.toFixed(1)}%</p>}
                  {r.pior && <p>Menor: {MESES[r.pior.mes - 1].slice(0, 3)} · {r.pior.percentual.toFixed(1)}%</p>}
                </article>
              ))}
            </div>
            <div className={styles.painel}>
              <div className={styles.cabecalho}><div><h3>Manhã × Noite</h3>
              <p className="muted">{lojaFiltro === "geral"
                ? "Todas as lojas: vendas e metas somadas por turno."
                : "Resultado mensal da loja selecionada."}</p></div>
              <label>Comparar
                <select value={lojaFiltro} onChange={(e) => setLojaFiltro(e.target.value)}>
                  <option value="geral">Geral das 3 lojas</option>
                  {lojasOrdenadas.map((l) =>
                    <option key={l.id} value={String(l.id)}>{l.codigo} · {l.nome}</option>)}
                </select>
              </label>
            </div>
            <div className={styles.scroll}><table>
              <thead><tr><th scope="col">Mês</th><th scope="col">Manhã</th><th scope="col">Noite</th></tr></thead>
              <tbody>{MESES.map((nome, i) => <tr key={nome}>
                <th scope="row">{nome.slice(0, 3)}</th>
                {PERIODOS.map((p) => <td key={p}>
                  <StatusCelula
                    resultado={lojaFiltro === "geral" ? resultadoGeral(i + 1, p) : resultado(lojaSelecionada, i + 1, p)}
                    titulo={nome + " " + (lojaFiltro === "geral" ? "Geral das lojas" : lojaSelecionada.nome) + " " + p}
                    aoAbrir={() => setDetalhe(i + 1)}
                  />
                </td>)}
              </tr>)}</tbody>
            </table></div>
            </div>
          </>}
          {detalhe !== null && createPortal(
            <div
              className={styles.modalFundo}
              onMouseDown={(evento) => {
                if (evento.target === evento.currentTarget) setDetalhe(null);
              }}
            >
              <section
                className={styles.modalJanela}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ranking-anual-modal-titulo"
              >
                <header className={styles.modalCabecalho}>
                  <div>
                    <p className={styles.modalSubtitulo}>Detalhes do mês</p>
                    <h3 id="ranking-anual-modal-titulo">{MESES[detalhe - 1]} de {ano}</h3>
                  </div>
                  <button
                    ref={fecharModalRef}
                    type="button"
                    className={styles.fechar}
                    aria-label="Fechar detalhes do mês"
                    onClick={() => setDetalhe(null)}
                  >Fechar ×</button>
                </header>
                <div className={styles.modalConteudo}>
                  <div className={styles.detalhes}>
                    {tipo === "turnos" && lojaFiltro === "geral" && (
                      <CartaoDetalheMensal
                        titulo="Geral das 3 lojas"
                        resultado={resultadoGeral(detalhe)}
                        manha={resultadoGeral(detalhe, "manha")}
                        noite={resultadoGeral(detalhe, "noite")}
                      />
                    )}
                    {(tipo === "turnos" && lojaFiltro !== "geral" ? [lojaSelecionada] : lojasOrdenadas).map((loja) => (
                      <CartaoDetalheMensal
                        key={loja.id}
                        titulo={loja.codigo + " · " + loja.nome}
                        resultado={resultado(loja, detalhe)}
                        manha={resultado(loja, detalhe, "manha")}
                        noite={resultado(loja, detalhe, "noite")}
                      />
                    ))}
                  </div>
                </div>
              </section>
            </div>,
            document.body
          )}
        </>}
    </section>
  );
}
