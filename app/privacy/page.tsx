import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Informativa"
      title="Privacy Policy"
      updated="2026-05-22"
      sections={[
        {
          h: "1. Titolare del trattamento",
          p: `PYDANTIC ("noi") è un servizio web che genera infografiche per inserzioni Amazon a partire da un ASIN. Per qualsiasi richiesta relativa ai tuoi dati personali puoi contattarci via email all'indirizzo presente in fondo a questa pagina.`,
        },
        {
          h: "2. Dati che raccogliamo",
          p: `Raccogliamo solo i dati strettamente necessari al funzionamento del servizio:`,
          list: [
            "Email e password (cifrata) se decidi di registrare un account — gestiti da Supabase Auth.",
            "ASIN inseriti, prompts.json generati e log delle run (ASIN, timestamp, costo stimato, modelli AI utilizzati).",
            "Cookie tecnici essenziali (sessione, consenso cookie, preferenze app).",
            "Solo previo consenso esplicito: metriche di utilizzo aggregate e anonime per migliorare il servizio.",
          ],
        },
        {
          h: "3. Finalità del trattamento",
          p: `I dati vengono trattati esclusivamente per:`,
          list: [
            "Erogare il servizio richiesto (generazione delle infografiche, caching dei risultati).",
            "Mantenere la sessione utente e proteggere l'account.",
            "Adempiere a obblighi di legge.",
            "Migliorare il servizio in forma aggregata (solo con consenso).",
          ],
        },
        {
          h: "4. Base giuridica",
          p: `Esecuzione del contratto (art. 6.1.b GDPR) per i dati necessari al servizio; consenso (art. 6.1.a GDPR) per le metriche di utilizzo opzionali.`,
        },
        {
          h: "5. Conservazione",
          p: `Conserviamo i dati account finché mantieni il tuo profilo attivo. I log delle generazioni (mariano_runs) vengono mantenuti per massimo 12 mesi a fini di analytics interne e debugging.`,
        },
        {
          h: "6. Sub-fornitori",
          p: `Per erogare il servizio condividiamo strettamente i dati necessari con i seguenti fornitori, tutti compliant GDPR:`,
          list: [
            "Vercel (hosting + edge functions) — USA / EU.",
            "Supabase (database + auth) — EU.",
            "Anthropic (modelli AI Claude) — USA, DPA stipulato.",
            "Google AI (modelli Gemini Nano Banana) — USA, DPA stipulato.",
            "OpenAI (modello fallback GPT-Image-1) — USA, DPA stipulato.",
            "Rainforest API (scraping prodotti Amazon) — USA.",
            "Cloudflare R2 (storage immagini, opzionale) — USA / EU.",
          ],
        },
        {
          h: "7. I tuoi diritti",
          p: `In qualsiasi momento puoi: accedere ai tuoi dati, chiederne la rettifica o la cancellazione, opporti al trattamento, richiedere la portabilità, o revocare il consenso. Per esercitare questi diritti contattaci via email. Hai anche diritto a presentare reclamo al Garante Privacy.`,
        },
        {
          h: "8. Contatti",
          p: `Per qualsiasi richiesta relativa a questa policy o ai tuoi dati personali, contattaci all'indirizzo email pubblicato nella sezione contatti.`,
        },
      ]}
    />
  );
}
