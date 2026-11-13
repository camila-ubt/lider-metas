import styles from "./SinalExpandir.module.css";

// Ícone comum aos controles de seção. Em <details>, o CSS acompanha o estado nativo.
export default function SinalExpandir({ aberto, nativo = false }) {
  return (
    <span className={`${styles.sinal} ${nativo ? styles.nativo : ""}`} aria-hidden="true">
      {nativo ? null : aberto ? "−" : "+"}
    </span>
  );
}
