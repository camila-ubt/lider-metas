"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const periodos = ["manha", "noite"];
const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatarData(data) {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
  });
}

function valorParaEdicao(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function interpretarValor(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return Number.NaN;
  return Number(texto.replace(/\./g, "").replace(",", "."));
}

export default function FluxoPendenciasLancamento() {
  const supabase = useMemo(() => createClient(), []);
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState("");
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [lojaId, setLojaId] = useState("");
  const [aba, setAba] = useState("pendentes");
  const [slot, setSlot] = useState(null);
  const [valor, setValor] = useState("");
  const [caixaNaoAberto, setCaixaNaoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    function capturar(evento) {
      const botao = evento.target.closest("button.calendar-day:not(.calendar-day-empty)");
      if (!botao) return;
      const numero = botao.querySelector(".calendar-number")?.textContent?.trim();
      const mes = document.querySelector('input[type="month"]')?.value;
      if (!numero || !mes) return;

      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation();
      void abrir(`${mes}-${String(numero).padStart(2, "0")}`);
    }

    document.addEventListener("click", capturar, true);
    return () => document.removeEventListener("click", capturar, true);
  }, []);

  async function abrir(data) {
    setErro("");
    setInicio(data);
    setSlot(null);
    setAba("pendentes");
    setValor("");
    setCaixaNaoAberto(false);

    const [lojasResposta, vendasResposta] = await Promise.all([
      supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
      supabase
        .from("vendas_diarias")
        .select("*")
        .eq("data", data)
        .order("periodo", { ascending: true }),
    ]);

    if (lojasResposta.error || vendasResposta.error) {
      setErro(
        lojasResposta.error?.message ||
          vendasResposta.error?.message ||
          "Não foi possível carregar os lançamentos.",
      );
      return;
    }

    const listaLojas = lojasResposta.data || [];
    setLojas(listaLojas);
    setVendas(vendasResposta.data || []);
    setLojaId(String(listaLojas[0]?.id || ""));
    setAberto(true);
  }

  const pendencias = useMemo(() => {
    if (!inicio || !lojaId) return [];

    return periodos
      .filter(
        (periodo) =>
          !vendas.some(
            (venda) =>
              venda.data === inicio &&
              Number(venda.loja_id) === Number(lojaId) &&
              venda.periodo === periodo,
          ),
      )
      .map((periodo) => ({ data: inicio, periodo, existente: false }));
  }, [inicio, lojaId, vendas]);

  const lancados = useMemo(
    () =>
      vendas
        .filter(
          (venda) =>
            venda.data === inicio &&
            Number(venda.loja_id) === Number(lojaId),
        )
        .sort((a, b) => b.periodo.localeCompare(a.periodo)),
    [inicio, lojaId, vendas],
  );

  function selecionar(item, existente = false) {
    setSlot({
      id: item.id || null,
      data: item.data,
      periodo: item.periodo,
      existente,
    });
    setValor(existente ? valorParaEdicao(item.valor_vendido) : "");
    setCaixaNaoAberto(existente && item.observacao === "Caixa não aberto");
    setErro("");
  }

  async function salvar(evento) {
    evento.preventDefault();
    const numero = interpretarValor(valor);
    if (!Number.isFinite(numero) || numero < 0) {
      setErro("Informe um valor válido.");
      return;
    }

    setSalvando(true);
    setErro("");
    const { data: sessao } = await supabase.auth.getSession();

    const { data, error } = await supabase
      .from("vendas_diarias")
      .upsert(
        {
          data: slot.data,
          loja_id: Number(lojaId),
          periodo: slot.periodo,
          valor_vendido: numero,
          observacao: caixaNaoAberto && numero === 0 ? "Caixa não aberto" : null,
          atualizado_por: sessao.session?.user?.id,
        },
        { onConflict: "data,loja_id,periodo" },
      )
      .select()
      .single();

    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }

    setVendas((atual) => [
      ...atual.filter(
        (item) =>
          !(
            item.data === data.data &&
            Number(item.loja_id) === Number(data.loja_id) &&
            item.periodo === data.periodo
          ),
      ),
      data,
    ]);
    setSlot(null);
    setValor("");
    setCaixaNaoAberto(false);
    setAba("lancados");
    setSalvando(false);
  }

  async function removerLancamento() {
    if (!slot?.existente) return;
    if (!window.confirm(`Remover o lançamento de ${formatarData(slot.data)}?`)) return;

    setSalvando(true);
    let consulta = supabase.from("vendas_diarias").delete();
    consulta = slot.id
      ? consulta.eq("id", slot.id)
      : consulta
          .eq("data", slot.data)
          .eq("loja_id", Number(lojaId))
          .eq("periodo", slot.periodo);

    const { error } = await consulta;
    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }

    setVendas((atual) =>
      atual.filter(
        (item) =>
          !(
            item.data === slot.data &&
            Number(item.loja_id) === Number(lojaId) &&
            item.periodo === slot.periodo
          ),
      ),
    );
    setSlot(null);
    setValor("");
    setCaixaNaoAberto(false);
    setAba("pendentes");
    setSalvando(false);
  }

  if (!aberto) return null;

  const lojaAtual = lojas.find((loja) => Number(loja.id) === Number(lojaId));

  return (
    <div
      className="fluxo-pendencias-backdrop"
      onMouseDown={(evento) => evento.target === evento.currentTarget && setAberto(false)}
    >
      <section className="fluxo-pendencias-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <p>LANÇAMENTOS</p>
            <h2>Lançamentos de {formatarData(inicio)}</h2>
          </div>
          <button type="button" onClick={() => setAberto(false)} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="fluxo-lojas">
          {lojas.map((loja) => {
            const total = periodos.filter(
              (periodo) =>
                !vendas.some(
                  (venda) =>
                    venda.data === inicio &&
                    Number(venda.loja_id) === Number(loja.id) &&
                    venda.periodo === periodo,
                ),
            ).length;

            return (
              <button
                type="button"
                key={loja.id}
                className={Number(loja.id) === Number(lojaId) ? "ativo" : ""}
                onClick={() => {
                  setLojaId(String(loja.id));
                  setSlot(null);
                  setAba("pendentes");
                }}
              >
                <strong>{loja.codigo}</strong>
                <span>{total === 0 ? "OK" : total}</span>
              </button>
            );
          })}
        </div>

        {!slot ? (
          <>
            <div className="fluxo-abas">
              <button
                type="button"
                className={aba === "pendentes" ? "ativo" : ""}
                onClick={() => setAba("pendentes")}
              >
                Pendentes ({pendencias.length})
              </button>
              <button
                type="button"
                className={aba === "lancados" ? "ativo" : ""}
                onClick={() => setAba("lancados")}
              >
                Lançados ({lancados.length})
              </button>
            </div>

            <div className="fluxo-lista">
              <div className="fluxo-lista-titulo">
                <strong>{lojaAtual?.nome || lojaAtual?.codigo}</strong>
                <span>
                  {aba === "pendentes"
                    ? pendencias.length === 0
                      ? "Dia completo"
                      : `${pendencias.length} pendência(s) neste dia`
                    : `${lancados.length} lançamento(s) neste dia`}
                </span>
              </div>

              {aba === "pendentes" ? (
                pendencias.length === 0 ? (
                  <div className="fluxo-vazio">✓ Dia conferido — tudo OK</div>
                ) : (
                  pendencias.map((item) => (
                    <button
                      type="button"
                      key={`${item.data}-${item.periodo}`}
                      onClick={() => selecionar(item)}
                    >
                      <div>
                        <strong>{formatarData(item.data)}</strong>
                        <span>{item.periodo === "manha" ? "Manhã" : "Noite"}</span>
                      </div>
                      <b>Preencher</b>
                    </button>
                  ))
                )
              ) : lancados.length === 0 ? (
                <div className="fluxo-vazio neutro">
                  Nenhum lançamento nesta loja e neste dia
                </div>
              ) : (
                lancados.map((item) => (
                  <button
                    type="button"
                    key={item.id || `${item.data}-${item.periodo}`}
                    onClick={() => selecionar(item, true)}
                  >
                    <div>
                      <strong>{formatarData(item.data)}</strong>
                      <span>{item.periodo === "manha" ? "Manhã" : "Noite"}</span>
                    </div>
                    <b>{dinheiro.format(Number(item.valor_vendido || 0))} · Editar</b>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <form className="fluxo-form" onSubmit={salvar}>
            <button type="button" className="voltar" onClick={() => setSlot(null)}>
              ← Voltar
            </button>
            <div className="fluxo-resumo">
              <strong>
                {lojaAtual?.codigo} · {formatarData(slot.data)}
              </strong>
              <span>{slot.periodo === "manha" ? "Manhã" : "Noite"}</span>
            </div>

            <label>
              Valor vendido
              <input
                autoFocus
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(evento) => {
                  setValor(evento.target.value);
                  setCaixaNaoAberto(false);
                }}
                required
              />
            </label>

            <button
              type="button"
              className="caixa-fechado"
              onClick={() => {
                setValor("0,00");
                setCaixaNaoAberto(true);
              }}
            >
              Marcar caixa não aberto
            </button>

            <div className={`fluxo-acoes-form ${slot.existente ? "com-remover" : ""}`}>
              {slot.existente && (
                <button
                  type="button"
                  className="remover"
                  disabled={salvando}
                  onClick={removerLancamento}
                >
                  Remover lançamento
                </button>
              )}
              <button type="submit" className="salvar" disabled={salvando}>
                {salvando ? "Salvando..." : slot.existente ? "Salvar correção" : "Salvar lançamento"}
              </button>
            </div>
          </form>
        )}

        {erro && <p className="fluxo-erro">{erro}</p>}
      </section>
    </div>
  );
}
