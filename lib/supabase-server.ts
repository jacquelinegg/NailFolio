/**
 * Server-only Supabase client bound to the request cookie jar.
 *
 * Kept in its own module because `next/headers` cannot be bundled for the
 * browser — client components must import `@/lib/supabase` instead.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { serverEnv } from "@/lib/env";
import type { NailFolioSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/lib/types";

export async function createCookieSupabaseClient(): Promise<NailFolioSupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll(): { name: string; value: string }[] {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot mutate cookies. Session refresh is handled
          // by middleware in production; swallowing keeps rendering non-fatal.
        }
      },
    },
  });
}
