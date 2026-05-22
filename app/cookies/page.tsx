import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function CookiesPage() {
  return (
    <LegalPage
      kicker="Informativa"
      title="Cookie Policy"
      updated="2026-05-22"
      sections={[
        {
          h: "1. Cosa sono i cookie",
          p: `I cookie sono piccoli file di testo che il sito salva nel browser per ricordare informazioni utili tra una visita e l'altra. PYDANTIC usa principalmente localStorage — un meccanismo equivalente — e un numero ridotto di cookie tecnici.`,
        },
        {
          h: "2. Cookie e storage tecnici (sempre attivi)",
          p: `Necessari al funzionamento del sito. Non richiedono consenso:`,
          list: [
            "Sessione di autenticazione Supabase (sb-* cookie) — durata della sessione.",
            "cookie_consent_v1 (localStorage) — memorizza la tua scelta sui cookie. 12 mesi.",
            "recent_asins_v1 (localStorage) — ultimi 5 ASIN generati per accesso rapido.",
            "custom_slides_v1 (localStorage, se usato) — preferenze app personali.",
          ],
        },
        {
          h: "3. Cookie analitici (opzionali)",
          p: `Attivati solo se accetti i cookie dal banner. Raccolgono metriche aggregate e anonime di utilizzo (numero di generazioni, tempi medi, errori) per migliorare il servizio. Nessun cookie pubblicitario, nessun tracking cross-site.`,
        },
        {
          h: "4. Come gestire le tue preferenze",
          p: `Puoi cambiare la tua scelta in qualsiasi momento cliccando "Preferenze cookie" nel footer del sito. In alternativa puoi bloccare i cookie direttamente dalle impostazioni del browser, tenendo presente che disabilitare i cookie tecnici renderebbe inutilizzabile il login.`,
        },
        {
          h: "5. Cookie di terze parti",
          p: `Le immagini generate vengono opzionalmente servite da CDN (Cloudflare R2). I provider AI (Anthropic, Google AI, OpenAI) non impostano cookie sul tuo browser — le loro API vengono chiamate solo lato server.`,
        },
      ]}
    />
  );
}
