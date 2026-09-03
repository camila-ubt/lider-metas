"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AtalhoPAVendedoras() {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const router = useRouter();
  const [permitido, setPermitido] = useState(false);
  const [alvo, setAlvo] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function verificarAcesso() {
      const { data: sessaoResp } = await supabase.auth.getSession();
      const usuarioId = sessaoResp.session?.user?.id;

      if (!usuarioId) {
        if (ativo) setPermitido(false);
        return;
      }

      const { data: perfil } = await supabase
        .from("perfis")
        .select("papel,ativo")
        .eq("id", usuarioId)
        .maybeSingle();

      if (!ativo) return;
      setPermitido(
        Boolean(perfil?.ativo) && ["admin", "gestora"].includes(perfil?.papel),
      );
    }

    verificarAcesso();
    const { data: listener } = supabase.auth.onAuthStateChange(() => verificarAcesso());

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (pathname !== "/" || !permitido) {
      setAlvo(null);
      return undefined;
    }

    function localizarNavegacao() {
      setAlvo(document.querySelector("nav.tabs"));
    }

    localizarNavegacao();
    const observador = new MutationObserver(localizarNavegacao);
    observador.observe(document.body, { childList: true, subtree: true });

    return () => observador.disconnect();
  }, [pathname, permitido]);

  if (!permitido || pathname !== "/" || !alvo) return null;

  return createPortal(
    <button type="button" onClick={() => router.push("/pa-vendedoras")}>PA das vendedoras</button>,
    alvo,
  );
}
