import styles from "./SinalExpandir.module.css";

// Chevron largo e discreto; a direção acompanha o estado do controle.
export default function SinalExpandir({ aberto, nativo = false }) {
  return (
    <span
      className={`${styles.sinal} ${nativo ? styles.nativo : aberto ? styles.aberto : ""}`}
      aria-hidden="true"
    />
  );
}
