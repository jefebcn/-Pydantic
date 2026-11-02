"use client";

import Link from "next/link";
import { useData } from "./DataProvider";

/** Mostra un avviso chiaro se la dashboard non riesce a leggere il database. */
export function StatusBanner() {
  const { error } = useData();
  if (!error) return null;
  const setup = /SUPABASE_URL|SERVICE_ROLE|relation|does not exist|schema cache/i.test(error);
  return (
    <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
      {setup ? (
        <>
          <b>Database non ancora collegato.</b> Crea il progetto Supabase, esegui <code>supabase/schema.sql</code> e
          imposta <code>SUPABASE_URL</code> e <code>SUPABASE_SERVICE_ROLE_KEY</code> su Vercel.{" "}
          <Link href="/impostazioni" className="underline">Guida in Impostazioni</Link>
        </>
      ) : (
        <>Errore: {error}</>
      )}
    </div>
  );
}
