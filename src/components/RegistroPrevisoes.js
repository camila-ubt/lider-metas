"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { verificarQualidadeLancamentos } from "@/lib/qualidadeDados.mjs";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dia = (valor) => String(valor || "").slice(8, 10);
const textoMes = (valor) => {
  const partes = valor.split("-");
  return partes[1] + "/" + partes[0];
};

export default function RegistroPrevisoes({
  lojas, ano, numeroMes, filtroLoja, filtroPeriodo,
}) {
  const supabase = useMemo(() => createClient(), []);
  const [registros, setRegistros] = useState([]);
  const [mesEscolhido, setMesEscolhido] = useState("");
  const [erro, setErro] = useState(false);
  const [fechamento, setFechamento] = useState(null);
  const [validando, setValidando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      const { data, error } = await supabase.from("previsoes_diarias")
        .select("data_previsao,mes,dia_base,projecao_valor,chance_meta,chance_super,chance_mega")
        .eq("filtro_loja", String(filtroLoja))
        .eq("filtro_periodo", filtroPeriodo)
        .order("data_previsao", { ascending: false }).limit(150);
      if (cancelado) return;
      setErro(Boolean(error));
      const encontrados = data || [];
      setRegistros(encontrados);
      setMesEscolhido((atual) => encontrados.some((item) => item.mes.slice(0, 7) === atual)
        ? atual : (encontrados[0]?.mes.slice(0, 7) || ""));
    }
    carregar();
    return () => { cancelado = true; };
  }, [supabase, ano, numeroMes, filtroLoja, filtroPeriodo]);

  const linhas = useMemo(() => registros.filter((item) =>
    item.mes.slice(0, 7) === mesEscolhido), [registros, mesEscolhido]);
  const meses = [...new Set(registros.map((item) => item.mes.slice(0, 7)))];
  const agora = new Date();
  const mesAtual = String(agora.getFullYear()) + "-" + String(agora.getMonth() + 1).padStart(2, "0");

  useEffect(() => {
    if (!mesEscolhido || mesEscolhido >= mesAtual) {
      setFechamento(null);
      setValidando(false);
      return undefined;
    }
    let cancelado = false;
    async function conferir() {
      setValidando(true);
      setFechamento(null);
      const [anoAlvo, numeroAlvo] = mesEscolhido.split("-").map(Number);
      const ultimo = new Date(anoAlvo, numeroAlvo, 0).getDate();
      const [vendasResp, metasResp, fechadoResp] = await Promise.all([
        supabase.from("vendas_diarias")
          .select("data,loja_id,periodo,valor_vendido")
          .gte("data", mesEscolhido + "-01")
          .lte("data", mesEscolhido + "-" + String(ultimo).padStart(2, "0")),
        supabase.from("metas_mensais")
          .select("loja_id,periodo,valor_meta")
          .eq("mes", mesEscolhido + "-01"),
        supabase.from("fechamentos_vendas")
          .select("mes").eq("mes", mesEscolhido + "-01").maybeSingle(),
      ]);
      if (cancelado) return;
      if (vendasResp.error || metasResp.error || fechadoResp.error) {
        setFechamento({ status: "erro" });
      } else {
        const vendas = vendasResp.data || [];
        const metas = metasResp.data || [];
        const qualidade = verificarQualidadeLancamentos({
          vendas, metas, lojas, ano: anoAlvo, numeroMes: numeroAlvo,
          diaConcluido: ultimo, filtroLoja, filtroPeriodo,
        });
        const lojaIds = new Set(lojas.filter((loja) =>
          filtroLoja === "geral" || String(loja.id) === String(filtroLoja))
          .map((loja) => String(loja.id)));
        const turnos = filtroPeriodo === "todos" ? ["manha", "noite"] : [filtroPeriodo];
        const filtradas = vendas.filter((item) =>
          lojaIds.has(String(item.loja_id)) && turnos.includes(item.periodo));
        const metasFiltradas = metas.filter((item) =>
          lojaIds.has(String(item.loja_id)) && turnos.includes(item.periodo));
        const total = filtradas.reduce((s, item) => s + Number(item.valor_vendido), 0);
        const meta = metasFiltradas.reduce((s, item) => s + Number(item.valor_meta), 0);
        setFechamento({
          status: fechadoResp.data && qualidade.status === "ok" ? "ok" : "pendente",
          realizado: total, meta,
        });
      }
      setValidando(false);
    }
    conferir();
    return () => { cancelado = true; };
  }, [mesEscolhido, mesAtual, filtroLoja, filtroPeriodo, lojas, supabase]);

  const realizado = fechamento?.status === "ok" ? fechamento.realizado : null;
  const estado = realizado === null ? null : [
    ["Meta", 1], ["Super", 1.1], ["Mega", 1.2],
  ].map(([nome, fator]) => nome + ": " +
    (realizado >= fechamento.meta * fator ? "atingida" : "não atingida")).join(" · ");

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <strong>Previsões diárias registradas</strong>
      {erro ? (
        <small>O histórico ficará disponível após a migração do banco.</small>
      ) : registros.length === 0 ? (
        <small>Sem previsões salvas neste recorte. O registro começa na primeira consulta válida de cada dia.</small>
      ) : (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Mês registrado</span>
            <select value={mesEscolhido} onChange={(e) => setMesEscolhido(e.target.value)}>
              {meses.map((mes) => (
                <option value={mes} key={mes}>{textoMes(mes)}</option>
              ))}
            </select>
          </label>
          <small>
            {validando ? "Conferindo fechamento..." : estado ||
              "Fechamento real ainda não validado. A comparação aparece após o fechamento oficial e a conferência dos lançamentos."}
          </small>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 475, borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>
                {["Dia", "Previsão salva", "Fechamento real", "Erro (R$)", "Chance M / S / M"].map((titulo) =>
                  <th key={titulo} scope="col" style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: "6px 4px" }}>{titulo}</th>)}
              </tr></thead>
              <tbody>{linhas.map((item) => (
                <tr key={item.data_previsao}>
                  <td style={{ textAlign: "right", padding: "6px 4px" }}>{dia(item.data_previsao)}</td>
                  <td style={{ textAlign: "right", padding: "6px 4px" }}>{dinheiro.format(item.projecao_valor)}</td>
                  <td style={{ textAlign: "right", padding: "6px 4px" }}>{realizado === null ? "—" : dinheiro.format(realizado)}</td>
                  <td style={{ textAlign: "right", padding: "6px 4px" }}>{realizado === null ? "—" : dinheiro.format(Number(item.projecao_valor) - realizado)}</td>
                  <td style={{ textAlign: "right", padding: "6px 4px" }}>
                    {item.chance_meta}% / {item.chance_super}% / {item.chance_mega}%
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
