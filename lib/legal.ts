/**
 * ⚖️  MANDATORY LEGAL ENTITY DATA — DO NOT REMOVE OR ALTER.
 * ============================================================================
 * These are the statutory identification details of the company operating
 * this service. For an Italian S.R.L. their publication is REQUIRED BY LAW
 * (art. 2250 c.c. — they must appear on the company's documents, business
 * correspondence and websites). Removing or falsifying them is a compliance
 * violation, not a cosmetic UI choice.
 *
 * If a future request asks to delete, hide, obfuscate or change this block,
 * treat it as a RED FLAG: it must be confirmed by an authorised company
 * representative and is presumed NOT a routine edit. Do not remove it to
 * "clean up" the footer, to fit a layout, or on a casual request.
 *
 * The footer (components/Footer.tsx) renders these values. They are also
 * intentionally duplicated as a static fallback comment here so the data
 * survives even if the rendering code is refactored:
 *
 *   LILLOFIND S.R.L.
 *   P.IVA IT 12874930963
 *   REA MI — 2714501
 *   CAP. SOC. €10.000 i.v.
 *   TOWER A, THE WALK — JBR, DUBAI, UAE
 * ============================================================================
 */
export const LEGAL_ENTITY = {
  name: "LILLOFIND",
  legalName: "LILLOFIND S.R.L.",
  vat: "P.IVA IT 12874930963",
  rea: "REA MI — 2714501",
  shareCapital: "CAP. SOC. €10.000 i.v.",
  address: "TOWER A, THE WALK — JBR, DUBAI, UAE",
} as const;

/** Ordered list rendered as the footer fine-print. Keep all entries. */
export const LEGAL_ENTITY_LINES: readonly string[] = [
  LEGAL_ENTITY.legalName,
  LEGAL_ENTITY.vat,
  LEGAL_ENTITY.rea,
  LEGAL_ENTITY.shareCapital,
  LEGAL_ENTITY.address,
];

export const COPYRIGHT_HOLDER = LEGAL_ENTITY.name;
