/**
 * Optionaler Produktlink im Onlineshop.
 * Nur sichere Adressen: https:// (und http://localhost in der Entwicklung).
 * Es wird nie eine Shop-Seite abgerufen oder erraten.
 */

/** Entfernt umgebende Leerzeichen; leer wird zu null. */
export function normaliseProductUrl(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Prüft den Produktlink. Rückgabe: Fehlermeldung oder null (in Ordnung).
 * Ein leerer Wert ist erlaubt — der Link ist immer optional.
 */
export function validateProductUrl(value: string | null | undefined): string | null {
  const trimmed = normaliseProductUrl(value);
  if (trimmed === null) return null;
  if (/\s/.test(trimmed)) return "Der Produktlink darf keine Leerzeichen enthalten.";

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "Bitte eine vollständige Adresse mit https:// eingeben.";
  }

  if (url.protocol === "https:") {
    if (url.hostname === "") return "Bitte eine vollständige Adresse mit https:// eingeben.";
    return null;
  }
  if (url.protocol === "http:" && url.hostname === "localhost") return null;

  return "Nur Adressen mit https:// sind erlaubt.";
}

/** True, wenn der Wert als Produktlink verwendet werden darf. */
export function isValidProductUrl(value: string | null | undefined): boolean {
  return normaliseProductUrl(value) !== null && validateProductUrl(value) === null;
}
