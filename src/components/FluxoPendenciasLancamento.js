"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const periodos = ["manha", "noite"];
const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatarData(data) {
  if (!data) return "";
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

function lancamentosDaLoja(vendas, data, lojaId) {
  return vendas
    .filter(
      (venda) =>
        venda.data === data &&
        Number(venda.loja_id) === Number(lojaId),
    )
    .sort((a, b) => b.periodo.localeCompare(a.periodo));
}

function pendenciasDaLoja(vendas, data, lojaId) {
  return periodos
    .filter(
      (periodo) =>
        !vendas.some(
          (venda) =>
            venda.data === data &&
            Number(venda.loja_id) === Number(lojaId) &&
            venda.periodo === periodo,
        ),
    )
    .map((periodo) => ({
      data,
      periodo,
      existente: false,
    }));
}

export default function FluxoPendenciasLancamento() {
  const supabase = useMemo(() => createClient(), []);
  const [aberto, setAberto] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState("");
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [lojaId, setLojaId] = useState("");
  const [aba, setAba] = useState("pendentes");
  const [slot, setSlot] = useState(null);
  const [valor, setValor] = useState("");
  const [caixaNaoAberto, setCaixaNaoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    function capturar(evento) {
      const botao = evento.target.closest(
        "button.calendar-day:not(.calendar-day-empty)",
      );
      if (!botao) return;

      const numero = botao
        .querySelector(".calendar-number")
        ?.textContent?.trim();
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
    setAberto(true);
    setCarregando(true);
    setErro("");
    setDataSelecionada(data);
    setSlot(null);
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
      setCarregando(false);
      return;
    }

    const listaLojas = lojasResposta.data || [];
    const vendasDoDia = (vendasResposta.data || []).filter(
      (venda) => venda.data === data,
    );
    const primeiraLoja = String(listaLojas[0]?.id || "");
    const pendenciasPrimeiraLoja = pendenciasDaLoja(
      vendasDoDia,
      data,
      primeiraLoja,
    );

    setLojas(listaLojas);
    setVendas(vendasDoDia);
    setLojaId(primeiraLoja);
    setAba(pendenciasPrimeiraLoja.length ? "pendentes" : "lancados");
    setCarregando(false);
  }

  const pendencias = useMemo(
    () =>
      dataSelecionada && lojaId
        ? pendenciasDaLoja(vendas, dataSelecionada, lojaId)
        : [],
    [dataSelecionada, lojaId, vendas],
  );

  const lancados = useMemo(
    () =>
      dataSelecionada && lojaId
        ? lancamentosDaLoja(vendas, dataSelecionada, lojaId)
        : [],
    [dataSelecionada, lojaId, vendas],
  );

  function selecionarLoja(id) {
    const novoId = String(id);
    const faltantes = pendenciasDaLoja(vendas, dataSelecionada, novoId);
    setLojaId(novoId);
    setSlot(null);
    setAba(faltantes.length ? "pendentes" : "lancados");
  }

  function selecionar(item, existente = false) {
    setSlot({
      id: item.id || null,
      data: dataSelecionada,
      periodo: item.periodo,
      existente,
    });
    setValor(existente ? valorParaEdicao(item.valor_vendido) : "");
    setCaixaNaoAberto(
      existente && item.observacao === "Caixa não aberto",
    );
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
          data: dataSelecionada,
          loja_id: Number(lojaId),
          periodo: slot.periodo,
          valor_vendido: numero,
          observacao:
            caixaNaoAberto && numero === 0 ? "Caixa não aberto" : null,
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
            item.data === dataSelecionada &&
            Number(item.loja_id) === Number(lojaId) &&
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
    if (
      !window.confirm(
        `Remover o lançamento de ${formatarData(dataSelecionada)}?`,
      )
    ) {
      return;
    }

    setSalvando(true);
    setErro("");

    let consulta = supabase.from("vendas_diarias").delete();
    consulta = slot.id
      ? consulta.eq("id", slot.id)
      : consulta
          .eq("data", dataSelecionada)
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
            item.data === dataSelecionada &&
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

  const lojaAtual = lojas.find(
    (loja) => Number(loja.id) === Number(lojaId),
  );

  return (
    <div
      className="fluxo-pendencias-backdrop"
      onMouseDown={(evento) =>
        evento.target === evento.currentTarget && setAberto(false)
      }
    >
      <section
        className="fluxo-pendencias-modal"
        role="dialog"
        aria-modal="true"
        key={dataSelecionada}
      >
        <header>
          <div>
            <p>LANÇAMENTOS DO DIA</p>
            <h2>{formatarData(dataSelecionada)}</h2>
          </div>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        {carregando ? (
          <div className="fluxo-vazio neutro">Carregando o dia selecionado...</div>
        ) : (
          <>
            <div className="fluxo-lojas">
              {lojas.map((loja) => {
                const faltantes = pendenciasDaLoja(
                  vendas,
                  dataSelecionada,
                  loja.id,
                ).length;

                return (
                  <button
                    type="button"
                    key={loja.id}
                    className={
                      Number(loja.id) === Number(lojaId) ? "ativo" : ""
                    }
                    onClick={() => selecionarLoja(loja.id)}
                  >
                    <strong>{loja.codigo}</strong>
                    <span>{faltantes === 0 ? "OK" : faltantes}</span>
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
                    <span>Somente {formatarData(dataSelecionada)}</span>
                  </div>

                  {aba === "pendentes" ? (
                    pendencias.length === 0 ? (
                      <div className="fluxo-vazio">
                        ✓ Dia conferido — tudo OK
                      </div>
                    ) : (
                      pendencias.map((item) => (
                        <button
                          type="button"
                          key={item.periodo}
                          onClick={() => selecionar(item)}
                        >
                          <div>
                            <strong>{formatarData(dataSelecionada)}</strong>
                            <span>
                              {item.periodo === "manha" ? "Manhã" : "Noite"}
                            </span>
                          </div>
                          <b>Preencher</b>
                        </button>
                      ))
                    )
                  ) : lancados.length === 0 ? (
                    <div className="fluxo-vazio neutro">
                      Nenhum lançamento desta loja neste dia
                    </div>
                  ) : (
                    lancados.map((item) => (
                      <button
                        type="button"
                        key={item.id || item.periodo}
                        onClick={() => selecionar(item, true)}
                      >
                        <div>
                          <strong>{formatarData(dataSelecionada)}</strong>
                          <span>
                            {item.periodo === "manha" ? "Manhã" : "Noite"}
                          </span>
                        </div>
                        <b>
                          {dinheiro.format(Number(item.valor_vendido || 0))} ·
                          Editar
                        </b>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <form className="fluxo-form" onSubmit={salvar}>
                <button
                  type="button"
                  className="voltar"
                  onClick={() => setSlot(null)}
                >
                  ← Voltar
                </button>

                <div className="fluxo-resumo">
                  <strong>
                    {lojaAtual?.codigo} · {formatarData(dataSelecionada)}
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

                <div
                  className={`fluxo-acoes-form ${
                    slot.existente ? "com-remover" : ""
                  }`}
                >
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
                  <button
                    type="submit"
                    className="salvar"
                    disabled={salvando}
                  >
                    {salvando
                      ? "Salvando..."
                      : slot.existente
                        ? "Salvar correção"
                        : "Salvar lançamento"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {erro && <p className="fluxo-erro">{erro}</p>}
      </section>
    </div>
  );
}
