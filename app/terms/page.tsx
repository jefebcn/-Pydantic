import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Termini di Servizio" };

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Condizioni d'uso"
      title="Termini di Servizio"
      updated="2026-05-22"
      sections={[
        {
          h: "1. Accettazione",
          p: `Utilizzando PYDANTIC accetti integralmente questi termini. Se non sei d'accordo con anche solo una clausola, non utilizzare il servizio.`,
        },
        {
          h: "2. Oggetto del servizio",
          p: `PYDANTIC è uno strumento AI che genera infografiche destinate a inserzioni Amazon a partire da un ASIN. Il servizio è fornito "as is" senza garanzie di risultato.`,
        },
        {
          h: "3. Uso consentito",
          p: `Puoi usare PYDANTIC per generare materiale visivo per i tuoi prodotti Amazon o per quelli per cui sei autorizzato a creare contenuti commerciali. È vietato:`,
          list: [
            "Generare contenuti per prodotti di cui non detieni i diritti commerciali.",
            "Generare contenuti che violano le policy di Amazon (claim falsi, comparativi diretti scorretti, copyright altrui).",
            "Tentare di estrarre, decompilare o reverse-engineerare il sistema di prompt.",
            "Usare il servizio per attività illecite, fraudolente o lesive di terzi.",
          ],
        },
        {
          h: "4. Proprietà intellettuale",
          p: `Le immagini generate sono di tua proprietà ai fini commerciali, fermi restando i termini di servizio dei provider AI sottostanti (Anthropic, Google AI, OpenAI). I prompt, l'architettura e il codice di PYDANTIC restano di nostra proprietà.`,
        },
        {
          h: "5. Costi e fatturazione",
          p: `L'utilizzo del servizio può comportare costi legati alle API AI sottostanti. Lo schema di pricing è esposto nella dashboard. Eventuali costi pre-pagati non sono rimborsabili salvo malfunzionamenti documentati del servizio.`,
        },
        {
          h: "6. Limitazione di responsabilità",
          p: `Non garantiamo che le immagini generate siano sempre conformi alle policy di Amazon, prive di artefatti AI, o adatte allo scopo specifico. Sei tu responsabile della revisione finale prima della pubblicazione. La nostra responsabilità complessiva non eccede l'importo effettivamente pagato per il servizio negli ultimi 12 mesi.`,
        },
        {
          h: "7. Sospensione e termine",
          p: `Possiamo sospendere o terminare l'accesso al servizio in caso di violazione di questi termini, di mancato pagamento, o per esigenze tecniche/legali. Puoi cancellare il tuo account in qualsiasi momento.`,
        },
        {
          h: "8. Modifiche ai termini",
          p: `Possiamo aggiornare questi termini in qualsiasi momento. Le modifiche entrano in vigore dalla data di pubblicazione. L'uso continuato del servizio dopo le modifiche costituisce accettazione delle stesse.`,
        },
        {
          h: "9. Legge applicabile e foro competente",
          p: `Questi termini sono regolati dalla legge italiana. Per qualunque controversia il foro competente è quello del consumatore (se applicabile) o quello della sede operativa di PYDANTIC.`,
        },
      ]}
    />
  );
}
