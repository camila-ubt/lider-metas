import { createClient } from "@supabase/supabase-js";

let recoveryClient;

export function getRecoveryClient() {
  if (!recoveryClient) {
    recoveryClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        storageKey: "lider-pa-password-recovery-v1",
        persistSession: true,
        autoRefreshToken: true,
      } }
    );
  }
  return recoveryClient;
}
