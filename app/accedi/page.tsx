"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Shell";
import { Button, inputCls } from "@/components/ui";

function LoginForm() {
  const next = useSearchParams().get("next") || "/";
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      // ricarica tutto, così i dati riservati (magazzino) arrivano subito
      window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return;
    }
    setBusy(false);
    setErr((await res.json().catch(() => ({}))).error || "Accesso non riuscito");
  };

  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[28px] bg-sky p-7">
        <Logo size={48} />
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Area admin</h1>
        <p className="mt-1 text-sm text-ink/60">
          Panoramica e offerte sono visibili a tutti. Per magazzino, impostazioni e per segnare le offerte serve la password.
        </p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className={`${inputCls} mt-5 h-11`}
        />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <Button type="submit" variant="primary" disabled={busy || !password} className="mt-4 h-11 w-full">
          {busy ? "Controllo…" : "Entra"}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
