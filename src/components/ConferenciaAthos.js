"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./ConferenciaAthos.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function inicioMes(valor) {
  return `${valor}-01`;
}

function fimMes(valor) {
  const [ano, mes] = valor.split("-").map(Number);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(
    new Date(ano, mes, 0).getDate(),
  ).padStart(2, "0")}`;
}

function dataLocal(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(
    2,
    "0",
  )}`;
}

function mesDaTela() {
  const campo = document.querySelector('input[type="month"]');
  if (campo?.value) return campo.value;
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function abaLancamentosAtiva() {
  const botao = Array.from(document.querySelectorAll("nav.tabs button")).find(
    (item) => item.textContent?.trim() === "Lançar vendas",
  );
  return Boolean(botao?.classList.contains("active"));
}

export default function ConferenciaAthos() {
  const supabase = useMemo(() => createClient(), []);
  const [autenticado, setAutenticado] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState("");
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [lojaId, setLojaId] = useState("");
  const [ordem, setOrdem] = useState("recentes");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setAutenticado(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setAutenticado(Boolean(sessao));
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    function sincronizarTela() {
      setVisivel(abaLancamentosAtiva());
      setMes(mesDaTela());
    }

    sincronizarTela();
    document.addEventListener("click", sincronizarTela, true);
    document.addEventListener("change", sincronizarTela, true);

    const observador = new MutationObserver(sincronizarTela);
    observador.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      document.removeEventListener("click", sincronizarTela, true);
      document.removeEventListener("change", sincronizarTela, true);
      observador.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!autenticado || !visivel || !mes) return undefined;
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");

      const [lojasResp, vendasResp] = await Promise.all([
        supabase
          .from("lojas")
          .select("id,codigo,nome,ordem")
          .eq("ativa", true)
          .order("ordem"),
        supabase
          .from("vendas_diarias")
          .select("data,loja_id,periodo,valor_vendido")
          .gte("data", inicioMes(mes))
          .lte("data", fimMes(mes))
          .order("data", { ascending: true }),
      ]);

      if (cancelado) return;

      const falha = lojasResp.error || vendasResp.error;
      if (falha) {
        setErro(falha.message);
      } else {
        const lojasCarregadas = lojasResp.data || [];
        setLojas(lojasCarregadas);
        setVendas(vendasResp.data || []);
        setLojaId((atual) => {
          const aindaExiste = lojasCarregadas.some(
            (loja) => String(loja.id) === String(atual),
          );
          return aindaExiste ? atual : String(lojasCarregadas[0]?.id || "");
        });
      }
      setCarregando(false);
    }

    carregar();

    const canal = supabase
      .channel(`conferencia-athos-${mes}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendas_diarias" },
        carregar,
      )
      .subscribe();

    return () => {
      cancelado = true;
      supabase.removeChannel(canal);
    };
  }, [autenticado, visivel, mes, supabase]);

  useEffect(() => {
    if (!autenticado || !visivel || !mes) return undefined;

    let temporizadores = [];
    let desmontado = false;

    async function atualizarVendas() {
      const { data, error } = await supabase
        .from("vendas_diarias")
        .select("data,loja_id,periodo,valor_vendido")
        .gte("data", inicioMes(mes))
        .lte("data", fimMes(mes))
        .order("data", { ascending: true });

      if (!desmontado && !error) setVendas(data || []);
    }

    function atualizarAposLancamento(evento) {
      const formulario = evento.target;
      if (!(formulario instanceof HTMLFormElement)) return;
      if (!formulario.closest(".sale-modal")) return;

      temporizadores.forEach(clearTimeout);
      temporizadores = [350, 900].map((tempo) =>
        setTimeout(atualizarVendas, tempo),
      );
    }

    document.addEventListener("submit", atualizarAposLancamento, true);

    return () => {
      desmontado = true;
      temporizadores.forEach(clearTimeout);
      document.removeEventListener("submit", atualizarAposLancamento, true);
    };
  }, [autenticado, visivel, mes, supabase]);

  const resumo = useMemo(() => {
    if (!mes || !lojaId) {
      return { linhas: [], total: 0, completos: 0, parciais: 0, pendentes: 0 };
    }

    const [ano, numeroMes] = mes.split("-").map(Number);
    const hoje = new Date();
    const totalDiasMes = new Date(ano, numeroMes, 0).getDate();
    const mesAtual =
      ano === hoje.getFullYear() && numeroMes === hoje.getMonth() + 1;
    const mesFuturo =
      ano > hoje.getFullYear() ||
      (ano === hoje.getFullYear() && numeroMes > hoje.getMonth() + 1);
    const ultimoDiaExibido = mesFuturo
      ? 0
      : mesAtual
        ? Math.min(hoje.getDate(), totalDiasMes)
        : totalDiasMes;

    let total = 0;
    let completos = 0;
    let parciais = 0;
    let pendentes = 0;

    const linhas = Array.from({ length: ultimoDiaExibido }, (_, indice) => {
      const dia = indice + 1;
      const data = dataLocal(ano, numeroMes, dia);
      const vendasDia = vendas.filter(
        (venda) =>
          venda.data === data && Number(venda.loja_id) === Number(lojaId),
      );
      const manha = vendasDia.find((venda) => venda.periodo === "manha");
      const noite = vendasDia.find((venda) => venda.periodo === "noite");
      const preenchidos = Number(Boolean(manha)) + Number(Boolean(noite));
      const valor = vendasDia.reduce(
        (soma, venda) => soma + Number(venda.valor_vendido || 0),
        0,
      );

      total += valor;
      if (preenchidos === 2) completos += 1;
      if (preenchidos === 1) parciais += 1;
      if (preenchidos === 0) pendentes += 1;

      return {
        data,
        dia,
        valor,
        preenchidos,
        status:
          preenchidos === 2
            ? "Completo"
            : preenchidos === 1
              ? "Parcial"
              : "Pendente",
      };
    });

    return { linhas, total, completos, parciais, pendentes };
  }, [lojaId, mes, vendas]);

  const linhasOrdenadas = useMemo(() => {
    const linhas = [...resumo.linhas];
    return ordem === "recentes" ? linhas.reverse() : linhas;
  }, [ordem, resumo.linhas]);

  function abrirEdicaoDoDia(data) {
    window.dispatchEvent(
      new CustomEvent("lider-metas:abrir-lancamentos-dia", {
        detail: {
          data,
          lojaId: Number(lojaId),
          aba: "lancados",
        },
      }),
    );
  }

  if (!autenticado || !visivel) return null;

  const lojaSelecionada = lojas.find(
    (loja) => Number(loja.id) === Number(lojaId),
  );

  return (
    <section className={styles.wrapper}>
      <div className={styles.panel}>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setAberto((atual) => !atual)}
          aria-expanded={aberto}
        >
          <div>
            <span>Conferência com o Athos</span>
            <strong>{aberto ? "Ocultar relatório" : "Mostrar relatório diário"}</strong>
          </div>
          <i className={aberto ? styles.arrowOpen : ""}>⌄</i>
        </button>

        {aberto && (
          <div className={styles.content}>
            <div className={styles.intro}>
              <div>
                <strong>Total diário por loja</strong>
                <span>Manhã + noite do mês selecionado no topo.</span>
              </div>
              {lojaSelecionada && (
                <b>
                  {lojaSelecionada.codigo} · {dinheiro.format(resumo.total)}
                </b>
              )}
            </div>

            <div className={styles.loading}>
              Para conferir no Athos, acesse: <strong>Relatórios → Vendas → Vendas → Demonstrativo de vendas</strong>. Selecione <strong>Venda bruta diária</strong>, informe o período desde o dia 1º e toque em <strong>Visualizar</strong>.
            </div>

            <div className={styles.storeFilter} aria-label="Filtrar loja">
              {lojas.map((loja) => (
                <button
                  type="button"
                  className={
                    Number(loja.id) === Number(lojaId) ? styles.activeStore : ""
                  }
                  onClick={() => setLojaId(String(loja.id))}
                  key={loja.id}
                >
                  {loja.codigo}
                </button>
              ))}
            </div>

            {carregando && (
              <p className={styles.loading}>Atualizando conferência...</p>
            )}
            {erro && <p className={styles.error}>{erro}</p>}

            {!carregando && !erro && (
              <>
                <div className={styles.summary}>
                  <span>
                    <i className={styles.completeDot} /> {resumo.completos} dias completos
                  </span>
                  <span>
                    <i className={styles.partialDot} /> {resumo.parciais} parciais
                  </span>
                  <span>
                    <i style={{ background: "#c7c0cc" }} /> {resumo.pendentes} pendentes
                  </span>
                </div>

                <div className={styles.tableWrap}>
                  <div className={styles.tableHeader}>
                    <span>Data</span>
                    <span>Total</span>
                    <label className={styles.orderControl}>
                      <span className={styles.srOnly}>Ordenar datas</span>
                      <select
                        value={ordem}
                        onChange={(evento) => setOrdem(evento.target.value)}
                        aria-label="Ordenar datas"
                      >
                        <option value="recentes">Mais recentes</option>
                        <option value="antigas">Mais antigas</option>
                      </select>
                    </label>
                  </div>

                  <div className={styles.rows}>
                    {linhasOrdenadas.map((linha) => (
                      <div
                        className={`${styles.row} ${
                          linha.preenchidos === 2
                            ? styles.completeRow
                            : linha.preenchidos === 1
                              ? styles.partialRow
                              : styles.pendingRow
                        }`}
                        key={linha.data}
                      >
                        <div>
                          <strong>
                            {String(linha.dia).padStart(2, "0")}/{mes.slice(5, 7)}
                          </strong>
                          <small>{linha.status}</small>
                        </div>
                        <b>{dinheiro.format(linha.valor)}</b>
                        <button
                          type="button"
                          className={styles.editDay}
                          onClick={() => abrirEdicaoDoDia(linha.data)}
                          aria-label={`Editar lançamentos de ${String(linha.dia).padStart(2, "0")}/${mes.slice(5, 7)}`}
                          title="Editar lançamentos deste dia"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 20h4.2L19 9.2 14.8 5 4 15.8V20Zm2-3.4 8.8-8.8 1.4 1.4-8.8 8.8H6v-1.4ZM17.6 3.6a1.4 1.4 0 0 1 2 0l.8.8a1.4 1.4 0 0 1 0 2l-1.8 1.8-2.8-2.8 1.8-1.8Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className={styles.totalRow}>
                    <span>Total acumulado</span>
                    <strong>{dinheiro.format(resumo.total)}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
