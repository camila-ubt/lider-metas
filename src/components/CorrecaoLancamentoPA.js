"use client";

import { useRef, useState } from "react";
import styles from "@/app/pa-vendedoras/PAVendedoras.module.css";

export default function CorrecaoLancamentoPA({ item, supabase, onSalvou }) {
  const [aberto, setAberto] = useState(false);
  const [vendas, setVendas] = useState(String(item.vendas));
  const [pecas, setPecas] = useState(String(item.pecas));
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const enviando = useRef(false);
  const data = item.data.split("-").reverse().join("/");

  function abrir() {
    setVendas(String(item.vendas));
    setPecas(String(item.pecas));
    setMotivo("");
    setErro("");
    setAberto(true);
  }

  async function salvar(evento) {
    evento.preventDefault();
    if (enviando.current) return;
    const v = Number(vendas);
    const p = Number(pecas);
    if (!vendas.trim() || !pecas.trim() || !Number.isInteger(v) || !Number.isInteger(p)
      || v < 0 || p < v || p > 999 || v > 999) {
      setErro("Informe números inteiros de 0 a 999. Peças devem ser iguais ou maiores que vendas.");
      return;
    }
    if (motivo.trim().length < 3 || motivo.trim().length > 500) {
      setErro("Descreva o motivo da correção (3 a 500 caracteres).");
      return;
    }
    if (v === Number(item.vendas) && p === Number(item.pecas)) {
      setErro("Altere vendas ou peças para salvar a correção.");
      return;
    }
    enviando.current = true;
    setSalvando(true);
    setErro("");
    try {
      const { error } = await supabase.rpc("corrigir_lancamento_pa", {
        p_usuario_id: item.usuario_id, p_dia_id: item.dia_id, p_data: item.data,
        p_loja_id: item.loja_id, p_vendas_antes: Number(item.vendas), p_pecas_antes: Number(item.pecas),
        p_vendas: v, p_pecas: p, p_motivo: motivo.trim(),
      });
      if (error) throw error;
      setAberto(false);
      onSalvou();
    } catch (error) {
      setErro(error.code === "PGRST202"
        ? "A correção de lançamentos ainda precisa ser habilitada."
        : error.message || "Não foi possível salvar. Confira sua conexão e tente novamente.");
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  }

  return (
    <div className={styles.dailyEntry}>
      <div className={`${styles.tableRow} ${styles.editableRow}`}>
        <strong>{data}</strong>
        <span>{Number(item.vendas)}</span>
        <span>{Number(item.pecas)}</span>
        <span>{Number(item.pa || 0).toFixed(2).replace(".", ",")}</span>
        <button type="button" className={styles.textButton} onClick={abrir}
          disabled={salvando} aria-expanded={aberto} aria-label={`Corrigir lançamento de ${data}`}>
          Corrigir
        </button>
      </div>
      {aberto && (
        <form className={styles.correctionForm} onSubmit={salvar} aria-label={`Correção de ${data}`}>
          <p><strong>Corrigir {data} · {item.loja}</strong></p>
          <div className={styles.correctionFields}>
            <label>Vendas<input type="number" min="0" max="999" step="1" required value={vendas}
              disabled={salvando} onChange={(e) => setVendas(e.target.value)} /></label>
            <label>Peças<input type="number" min="0" max="999" step="1" required value={pecas}
              disabled={salvando} onChange={(e) => setPecas(e.target.value)} /></label>
          </div>
          <label>Motivo da correção<textarea required minLength={3} maxLength={500} rows={2}
            value={motivo} disabled={salvando} onChange={(e) => setMotivo(e.target.value)} /></label>
          <p className={styles.muted}>A vendedora receberá um aviso no PA. A loja precisará ser conferida novamente.</p>
          {erro && <p className={styles.approvalWarning} role="alert">{erro}</p>}
          <div className={styles.correctionActions}>
            <button type="button" className={styles.textButton} disabled={salvando} onClick={() => setAberto(false)}>Cancelar</button>
            <button type="submit" className={styles.saveCorrection} disabled={salvando}>{salvando ? "Salvando..." : "Salvar correção"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
