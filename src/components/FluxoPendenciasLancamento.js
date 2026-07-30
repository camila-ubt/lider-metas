"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const periodos = ["manha", "noite"];
const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function hojeLocal() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function proximaData(data) {
  const atual = new Date(`${data}T12:00:00`);
  atual.setDate(atual.getDate() + 1);
  return `${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, "0")}-${String(atual.getDate()).padStart(2, "0")}`;
}

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
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [alterou, setAlterou] = useState(false);

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
      abrir(`${mes}-${String(numero).padStart(2, "0")}`);
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
    setObservacao("");

    const fim = hojeLocal();
    const [{ data: lojasData, error: lojasErro }, { data: vendasData, error: vendasErro }] = await Promise.all([
      supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
      supabase.from("vendas_diarias").select("*").gte("data", data).lte("data", fim).order("data", { ascending: true }),
    ]);

    if (lojasErro || vendasErro) {
      setErro(lojasErro?.message || vendasErro?.message || "Não foi possível carregar os lançamentos.");
      return;
    }

    const listaLojas = lojasData || [];
    setLojas(listaLojas);
    setVendas(vendasData || []);
    setLojaId(String(listaLojas[0]?.id || ""));
    setAberto(true);
  }

  const pendencias = useMemo(() => {
    if (!inicio || !lojaId) return [];
    const resultado = [];
    let data = inicio;
    const fim = hojeLocal();

    while (data <= fim) {
      periodos.forEach((periodo) => {
        const existe = vendas.some(
          (venda) => venda.data === data && Number(venda.loja_id) === Number(lojaId) && venda.periodo === periodo
        );
        if (!existe) resultado.push({ data, periodo, existente: false });
      });
      data = proximaData(data);
    }

    return resultado;
  }, [inicio, lojaId, vendas]);

  const lancados = useMemo(
    () => vendas
      .filter((venda) => Number(venda.loja_id) === Number(lojaId))
      .sort((a, b) => b.data.localeCompare(a.data) || b.periodo.localeCompare(a.periodo)),
    [lojaId, vendas]
  );

  function selecionar(item, existente = false) {
    setSlot({
      id: item.id || null,
      data: item.data,
      periodo: item.periodo,
      existente,
    });
    setValor(existente ? valorParaEdicao(item.valor_vendido) : "");
    setObservacao(existente ? item.observacao || "" : "");
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
    let textoObservacao = observacao.trim();
    if (numero === 0 && !textoObservacao) textoObservacao = "Caixa não aberto";
    if (numero > 0 && textoObservacao === "Caixa não aberto") textoObservacao = "";

    const { data, error } = await supabase
      .from("vendas_diarias")
      .upsert(
        {
          data: slot.data,
          loja_id: Number(lojaId),
          periodo: slot.periodo,
          valor_vendido: numero,
          observacao: textoObservacao || null,
          atualizado_por: sessao.session?.user?.id,
        },
        { onConflict: "data,loja_id,periodo" }
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
        (item) => !(item.data === data.data && Number(item.loja_id) === Number(data.loja_id) && item.periodo === data.periodo)
      ),
      data,
    ]);
    setSlot(null);
    setValor("");
    setObservacao("");
    setAlterou(true);
    setSalvando(false);
  }

  async function removerLancamento() {
    if (!slot?.existente) return;

    const confirmar = window.confirm(
      `Remover o lançamento de ${formatarData(slot.data)} · ${slot.periodo === "manha" ? "Manhã" : "Noite"}?`
    );
    if (!confirmar) return;

    setSalvando(true);
    setErro("");

    let consulta = supabase.from("vendas_diarias").delete();
    if (slot.id) {
      consulta = consulta.eq("id", slot.id);
    } else {
      consulta = consulta
        .eq("data", slot.data)
        .eq("loja_id", Number(lojaId))
        .eq("periodo", slot.periodo);
    }

    const { error } = await consulta;
    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }

    setVendas((atual) => atual.filter(
      (item) => !(
        item.data === slot.data &&
        Number(item.loja_id) === Number(lojaId) &&
        item.periodo === slot.periodo
      )
    ));
    setSlot(null);
    setValor("");
    setObservacao("");
    setAba("pendentes");
    setAlterou(true);
    setSalvando(false);
  }

  function fechar() {
    setAberto(false);
    if (alterou) window.location.reload();
  }

  if (!aberto) return null;

  const lojaAtual = lojas.find((loja) => Number(loja.id) === Number(lojaId));

  return (
    <div className="fluxo-pendencias-backdrop" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <section className="fluxo-pendencias-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <p>LANÇAMENTOS</p>
            <h2>A partir de {formatarData(inicio)}</h2>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar">×</button>
        </header>

        <div className="fluxo-lojas">
          {lojas.map((loja) => {
            let total = 0;
            let data = inicio;
            while (data <= hojeLocal()) {
              periodos.forEach((periodo) => {
                if (!vendas.some((v) => v.data === data && Number(v.loja_id) === Number(loja.id) && v.periodo === periodo)) total += 1;
              });
              data = proximaData(data);
            }

            return (
              <button
                type="button"
                key={loja.id}
                className={Number(loja.id) === Number(lojaId) ? "ativo" : ""}
                onClick={() => { setLojaId(String(loja.id)); setSlot(null); setAba("pendentes"); }}
              >
                <strong>{loja.codigo}</strong>
                <span>{total}</span>
              </button>
            );
          })}
        </div>

        {!slot ? (
          <>
            <div className="fluxo-abas">
              <button type="button" className={aba === "pendentes" ? "ativo" : ""} onClick={() => setAba("pendentes")}>Pendentes ({pendencias.length})</button>
              <button type="button" className={aba === "lancados" ? "ativo" : ""} onClick={() => setAba("lancados")}>Lançados ({lancados.length})</button>
            </div>

            <div className="fluxo-lista">
              <div className="fluxo-lista-titulo">
                <strong>{lojaAtual?.nome || lojaAtual?.codigo}</strong>
                <span>{aba === "pendentes" ? `${pendencias.length} pendência${pendencias.length === 1 ? "" : "s"}` : `${lancados.length} lançamento${lancados.length === 1 ? "" : "s"}`}</span>
              </div>

              {aba === "pendentes" ? (
                pendencias.length === 0 ? (
                  <div className="fluxo-vazio">✓ Nenhuma pendência nesta loja</div>
                ) : pendencias.map((item) => (
                  <button type="button" key={`${item.data}-${item.periodo}`} onClick={() => selecionar(item)}>
                    <div><strong>{formatarData(item.data)}</strong><span>{item.periodo === "manha" ? "Manhã" : "Noite"}</span></div>
                    <b>Preencher</b>
                  </button>
                ))
              ) : (
                lancados.length === 0 ? (
                  <div className="fluxo-vazio neutro">Nenhum lançamento nesta loja</div>
                ) : lancados.map((item) => (
                  <button type="button" key={item.id || `${item.data}-${item.periodo}`} onClick={() => selecionar(item, true)}>
                    <div><strong>{formatarData(item.data)}</strong><span>{item.periodo === "manha" ? "Manhã" : "Noite"}</span></div>
                    <b>{dinheiro.format(Number(item.valor_vendido || 0))} · Editar</b>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <form className="fluxo-form" onSubmit={salvar}>
            <button type="button" className="voltar" onClick={() => setSlot(null)}>← Voltar para {slot.existente ? "lançados" : "pendências"}</button>
            <div className="fluxo-resumo">
              <strong>{lojaAtual?.codigo} · {formatarData(slot.data)}</strong>
              <span>{slot.periodo === "manha" ? "Manhã" : "Noite"}</span>
            </div>

            <label>
              Valor vendido
              <input autoFocus inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} required />
            </label>

            <button type="button" className="caixa-fechado" onClick={() => { setValor("0,00"); setObservacao("Caixa não aberto"); }}>
              Marcar caixa não aberto
            </button>

            <label>
              Observação
              <textarea rows="3" placeholder="Opcional" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </label>

            <div className={`fluxo-acoes-form ${slot.existente ? "com-remover" : ""}`}>
              {slot.existente && (
                <button type="button" className="remover" disabled={salvando} onClick={removerLancamento}>
                  Remover lançamento
                </button>
              )}
              <button type="submit" className="salvar" disabled={salvando}>
                {salvando ? "Salvando..." : slot.existente ? "Salvar correção" : "Salvar e remover da lista"}
              </button>
            </div>
          </form>
        )}

        {erro && <p className="fluxo-erro">{erro}</p>}
      </section>

      <style jsx global>{`
        .fluxo-pendencias-backdrop{position:fixed;inset:0;background:rgba(20,15,30,.66);z-index:9999;display:grid;place-items:center;padding:16px}
        .fluxo-pendencias-modal{width:min(560px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:24px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.28)}
        .fluxo-pendencias-modal header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}
        .fluxo-pendencias-modal header p{margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:.08em;color:#7650a7}.fluxo-pendencias-modal header h2{margin:0;font-size:22px}
        .fluxo-pendencias-modal header button{border:0;background:#f1edf5;border-radius:50%;width:38px;height:38px;font-size:24px;cursor:pointer}
        .fluxo-lojas{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}.fluxo-lojas button{border:1px solid #ddd3e8;background:#faf8fc;border-radius:16px;padding:13px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}.fluxo-lojas button.ativo{border-color:#7650a7;background:#f1eafa;box-shadow:0 0 0 2px rgba(118,80,167,.12)}.fluxo-lojas span{display:grid;place-items:center;min-width:28px;height:28px;border-radius:999px;background:#fff;font-weight:800}
        .fluxo-abas{display:grid;grid-template-columns:1fr 1fr;background:#f3eff6;border-radius:14px;padding:4px;margin-bottom:16px}.fluxo-abas button{border:0;background:transparent;border-radius:11px;padding:10px;font-weight:800;color:#6e6673;cursor:pointer}.fluxo-abas button.ativo{background:#fff;color:#7650a7;box-shadow:0 2px 8px rgba(40,20,55,.1)}
        .fluxo-lista-titulo{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.fluxo-lista-titulo span{font-size:13px;color:#6e6673}.fluxo-lista{display:grid;gap:9px}.fluxo-lista>button{border:1px solid #e5ddec;background:#fff;border-radius:16px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;text-align:left;cursor:pointer}.fluxo-lista>button:hover{background:#faf7fd;border-color:#bca9d1}.fluxo-lista>button div{display:grid;gap:3px}.fluxo-lista>button span{font-size:13px;color:#6e6673}.fluxo-lista>button b{font-size:13px;color:#7650a7}.fluxo-vazio{padding:30px;text-align:center;border-radius:16px;background:#eef9f1;color:#24723b;font-weight:800}.fluxo-vazio.neutro{background:#f5f2f7;color:#6e6673}
        .fluxo-form{display:grid;gap:14px}.fluxo-form .voltar{justify-self:start;border:0;background:transparent;color:#7650a7;font-weight:700;cursor:pointer;padding:0}.fluxo-resumo{display:flex;justify-content:space-between;background:#f5f1f8;border-radius:16px;padding:14px}.fluxo-form label{display:grid;gap:7px;font-weight:700}.fluxo-form input,.fluxo-form textarea{width:100%;box-sizing:border-box;border:1px solid #d9cfdf;border-radius:14px;padding:13px;font:inherit}.caixa-fechado{border:1px dashed #c7b7d6;background:#faf8fc;border-radius:14px;padding:12px;font-weight:700;cursor:pointer}.fluxo-acoes-form{display:grid;gap:10px}.fluxo-acoes-form.com-remover{grid-template-columns:1fr 1.4fr}.salvar{border:0;background:#7650a7;color:white;border-radius:14px;padding:14px;font-weight:800;cursor:pointer}.remover{border:1px solid #d78b8b;background:#fff5f5;color:#a32929;border-radius:14px;padding:14px;font-weight:800;cursor:pointer}.salvar:disabled,.remover:disabled{opacity:.6;cursor:wait}.fluxo-erro{margin:14px 0 0;color:#a32929;font-weight:700}
        @media(max-width:520px){.fluxo-pendencias-modal{padding:16px;border-radius:20px}.fluxo-lojas button{padding:11px 9px}.fluxo-lojas button strong{font-size:13px}.fluxo-lista>button b{max-width:50%;text-align:right}.fluxo-acoes-form.com-remover{grid-template-columns:1fr}.remover{order:2}}
      `}</style>
    </div>
  );
}