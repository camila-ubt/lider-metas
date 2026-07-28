import { createBrowserClient } from "@supabase/ssr";

let clienteNavegador;

export function createClient() {
  if (!clienteNavegador) {
    clienteNavegador = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
  }

  return clienteNavegador;
}
