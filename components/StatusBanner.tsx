"use client";

import Link from "next/link";
import { useData } from "./DataProvider";
import { ago, isScannerOn } from "@/lib/format";

/** Avviso chiaro se la dashboard non legge il database o se le offerte non sono più aggiornate. */
export function StatusBanner() {
  const { error, scanner, updatedAt, admin } = useData();
  if (!error && updatedAt && !isScannerOn(scanner.last_check, updatedAt.getTime())) {
    return (
      <div className="mb-5 rounded-3xl bg-cream p-4 text-sm">
        <b>Scanner fermo: ultimo controllo {ago(scanner.last_check)}.</b> Le offerte qui sotto sono quelle di quel momento: prima di
        comprare controlla il prezzo su Amazon.
        {admin && " Sul PC riapri avvia-scanner.bat, oppure controlla che il PC sia acceso e non in sospensione."}
      </div>
    );
  }
  if (!error) return null;
  const setup = /SUPABASE_URL|SERVICE_ROLE|relation|does not exist|schema cache/i.test(error);
  return (
    <div className="mb-5 rounded-3xl bg-red-50 p-4 text-sm text-red-700">
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
