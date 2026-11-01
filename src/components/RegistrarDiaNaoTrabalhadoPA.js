"use client";

import { useRef, useState } from "react";
import styles from "@/app/pa-vendedoras/PAVendedoras.module.css";

function dataAtualBrasil() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const parte = (tipo) => partes.find((item) => item.type === tipo)?.value || "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

function fimMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(ano, numeroMes, 0).getDate()).padStart(2, "0")}`;
}

export default function RegistrarDiaNaoTrabalhadoPA({ vendedora, mes, supabase, onSalvou }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const enviando = useRef(false);

  const primeiroDia = `${mes}-01`;
  const ultimaDataPermitida = [fimMes(mes), dataAtualBrasil()].sort()[0];

  function abrir() {
    setData("");
    setErro("");
    setAberto(true);
  }

  async function salvar(evento) {
    evento.preventDefault();
    if (enviando.current) return;

    if (!data || data < primeiroDia || data > ultimaDataPermitida) {
      setErro("Selecione um dia válido do mês, até a data de hoje.");
      return;
    }

    const dataFormatada = data.split("-").reverse().join("/");
    const confirmou = window.confirm(
      `Marcar ${dataFormatada} como não trabalhado para ${vendedora.nome || "a vendedora"}? Esse dia não terá vendas nem contará como trabalhado no PA.`,
    );
    if (!confirmou) return;

    enviando.current = true;
    setSalvando(true);
    setErro("");
    try {
      const { error } = await supabase.rpc("registrar_dia_nao_trabalhado_pa_gestao", {
        p_usuario_id: vendedora.usuario_id,
        p_data: data,
      });
      if (error) throw error;

      setAberto(false);
      onSalvou({ data });
    } catch (error) {
      setErro(error.code === "PGRST202"
        ? "O registro de dias não trabalhados pela gestão ainda precisa ser habilitado no banco."
        : error.message || "Não foi possível marcar o dia. Tente novamente.");
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  }

  return (
    <div className={styles.addEntry}>
      <button
        type="button"
        className={styles.addEntryButton}
        onClick={abrir}
        disabled={salvando || ultimaDataPermitida < primeiroDia}
        aria-expanded={aberto}
      >
        Marcar dia não trabalhado
      </button>
      {aberto && (
        <form className={styles.correctionForm} onSubmit={salvar} aria-label="Marcar dia não trabalhado da vendedora">
          <p><strong>Dia não trabalhado · {vendedora.nome || "Vendedora"}</strong></p>
          <div className={styles.vacationFields}>
            <label>
              Data
              <input
                type="date"
                required
                min={primeiroDia}
                max={ultimaDataPermitida}
                value={data}
                disabled={salvando}
                onChange={(e) => setData(e.target.value)}
              />
            </label>
          </div>
          <p className={styles.muted}>
            Para folga ou outro dia em que não trabalhou. Não precisa selecionar loja, vendas ou peças. Não conta como dia trabalhado e permite completar o último dia do mês. Dias com vendas não serão alterados.
          </p>
          {erro && <p className={styles.approvalWarning} role="alert">{erro}</p>}
          <div className={styles.correctionActions}>
            <button type="button" className={styles.textButton} disabled={salvando} onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button type="submit" className={styles.saveCorrection} disabled={salvando}>
              {salvando ? "Salvando..." : "Confirmar dia não trabalhado"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
