"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const periodos = ["manha", "noite"];
const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function hojeLocal() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function fimDoMes(data) {
  const [ano, mes] = String(data).slice(0, 7).split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
}

function dataFinalDasPendencias(dataInicial) {
  const hoje = hojeLocal();
  const ultimoDiaDoMes = fimDoMes(dataInicial);

  if (dataInicial > hoje) return dataInicial;
  return hoje < ultimoDiaDoMes ? hoje : ultimoDiaDoMes;
}

function proximaData(data) {
  const atual = new Date(`${data}T12:00:00`);
  atual.setDate(atual.getDate() + 1);
  return `${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, "0")}-${String(atual.getDate()).padStart(2, "0")}`;
}

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

function pendenciasDaLoja(vendas, dataInicial, lojaId) {
  if (!dataInicial || !lojaId) return [];

  const resultado = [];
  const dataFinal = dataFinalDasPendencias(dataInicial);
  let data = dataInicial;

  while (data <= dataFinal) {
    periodos.forEach((periodo) => {
      const existe = vendas.some(
        (venda) =>
          venda.data === data &&
          Number(venda.loja_id) === Number(lojaId) &&
          venda.periodo === periodo,
      );

      if (!existe) {
        resultado.push({ data, periodo, existente: false });
      }
    });

    data = proximaData(data);
  }

  return resultado;
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

      const numero = botao.querySelector(".calendar-number")?.textContent?.trim();
      const mes = document.querySelector('input[type="month"]')?.value;
      if (!numero || !mes) return;

      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation();

      void abrir(`${mes}-${String(numero).padStart(2, "0")}`);
    }

    function abrirPeloRelatorio(evento) {
      const data = evento.detail?.data;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) return;

      void abrir(data, {
        lojaId: evento.detail?.lojaId,
        aba: evento.detail?.aba || "lancados",
      });
    }

    document.addEventListener("click", capturar, true);
    window.addEventListener(
      "lider-metas:abrir-lancamentos-dia",
      abrirPeloRelatorio,
    );

    return () => {
      document.removeEventListener("click", capturar, true);
      window.removeEventListener(
        "lider-metas:abrir-lancamentos-dia",
        abrirPeloRelatorio,
      );
    };
  }, []);

  async function abrir(data, opcoes = {}) {
    setAberto(true);
    setCarregando(true);
    setErro("");
    setDataSelecionada(data);
    setSlot(null);
    setValor("");
    setCaixaNaoAberto(false);

    const dataFinal = dataFinalDasPendencias(data);

    const [lojasResposta, vendasResposta] = await Promise.all([
      supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
      supabase
        .from("vendas_diarias")
        .select("*")
        .gte("data", data)
        .lte("data", dataFinal)
        .order("data", { ascending: true })
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
    const vendasDoIntervalo = (vendasResposta.data || []).filter(
      (venda) => venda.data >= data && venda.data <= dataFinal,
    );
    const lojaSolicitada = listaLojas.some(
      (loja) => Number(loja.id) === Number(opcoes.lojaId),
    )
      ? String(opcoes.lojaId)
      : String(listaLojas[0]?.id || "");
    const pendenciasLoja = pendenciasDaLoja(
      vendasDoIntervalo,
      data,
      lojaSolicitada,
    );

    setLojas(listaLojas);
    setVendas(vendasDoIntervalo);
    setLojaId(lojaSolicitada);
    setAba(
      opcoes.aba === "lancados"
        ? "lancados"
        : pendenciasLoja.length
          ? "pendentes"
          : "lancados",
    );
    setCarregando(false);
  }

  const pendencias = useMemo(
    () => pendenciasDaLoja(vendas, dataSelecionada, lojaId),
    [dataSelecionada, lojaId, vendas],
  );

  const lancados = useMemo(
    () => lancamentosDaLoja(vendas, dataSelecionada, lojaId),
    [dataSelecionada, lojaId, vendas],
  );

  function selecionarLoja(id) {
    const novoId = String(id);
    const faltantes = pendenciasDaLoja(vendas, dataSelecionada, novoId);
    setLojaId(novoId);
    setSlot(null);
    setAba((atual) =>
      atual === "lancados"
        ? "lancados"
        : faltantes.length
          ? "pendentes"
          : "lancados",
    );
  }

  function selecionar(item, existente = false) {
    setSlot({
      id: item.id || null,
      data: item.data,
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
    const dataDoLancamento = slot.data;
    const { data: sessao } = await supabase.auth.getSession();

    const { data, error } = await supabase
      .from("vendas_diarias")
      .upsert(
        {
          data: dataDoLancamento,
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
    setAba(dataDoLancamento === dataSelecionada ? "lancados" : "pendentes");
    setSalvando(false);
  }

  async function removerLancamento() {
    if (!slot?.existente) return;
    if (!window.confirm(`Remover o lançamento de ${formatarData(slot.data)}?`)) {
      return;
    }

    setSalvando(true);
    setErro("");

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
            <p>{aba === "pendentes" ? "PENDÊNCIAS" : "LANÇAMENTOS DO DIA"}</p>
            <h2>
              {aba === "pendentes"
                ? `A partir de ${formatarData(dataSelecionada)}`
                : formatarData(dataSelecionada)}
            </h2>
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
          <div className="fluxo-vazio neutro">Carregando lançamentos...</div>
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
                    <span>
                      {aba === "pendentes"
                        ? `Pendências desde ${formatarData(dataSelecionada)}`
                        : `Somente ${formatarData(dataSelecionada)}`}
                    </span>
                  </div>

                  {aba === "pendentes" ? (
                    pendencias.length === 0 ? (
                      <div className="fluxo-vazio">
                        ✓ Nenhuma pendência a partir desta data
                      </div>
                    ) : (
                      pendencias.map((item) => (
                        <button
                          type="button"
                          key={`${item.data}-${item.periodo}`}
                          onClick={() => selecionar(item)}
                        >
                          <div>
                            <strong>{formatarData(item.data)}</strong>
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
                          {dinheiro.format(Number(item.valor_vendido || 0))} · Editar
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
