/**
 * Amazon listing image-naming convention.
 *
 * The white-background hero (slide 01a) is the MAIN image; every other
 * produced image becomes PT01, PT02, … in the order they appear on the site,
 * renumbered contiguously among the images actually generated.
 *
 *   01a            -> {ASIN}.MAIN
 *   next produced  -> {ASIN}.PT01
 *   next           -> {ASIN}.PT02
 *   …
 *
 * Returns a map slideNumber -> base filename (without extension).
 */
export function amazonNames(asin: string, images: { number: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  let pt = 1;
  for (const im of images) {
    if (im.number === "01a") {
      out[im.number] = `${asin}.MAIN`;
    } else {
      out[im.number] = `${asin}.PT${String(pt).padStart(2, "0")}`;
      pt += 1;
    }
  }
  return out;
}
