// Finds the form behind a saved post ("Fill it for me" on any saved post with a form).

const FORM_HOSTS = /(^|\.)(forms\.gle|typeform\.com|jotform\.com|jotform\.me|form\.jotform\.com|tally\.so)$/i;
const FORM_PATH = /\/(apply|register|registration|signup|sign-up)(\/|$|\?)|webform/i;
const SOCIAL = /(^|\.)(x\.com|twitter\.com)$/i;
const SHORTENER = /(^|\.)(t\.co|bit\.ly|tinyurl\.com|ow\.ly|buff\.ly|lnkd\.in)$/i;

const host = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

/** Every http(s) URL in the texts, in order, without trailing punctuation. */
export function extractUrls(texts: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const text of texts) {
    for (const m of (text ?? "").matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) {
      const url = m[0].replace(/[.,;:!?…]+$/, "");
      if (host(url) && !out.includes(url)) out.push(url);
    }
  }
  return out;
}

export function isFormLike(url: string): boolean {
  const h = host(url);
  if (!h || SOCIAL.test(h)) return false;
  if (FORM_HOSTS.test(h)) return true;
  if (h === "docs.google.com" && /\/forms\//i.test(url)) return true;
  try {
    const u = new URL(url);
    return FORM_PATH.test(u.pathname + u.search);
  } catch {
    return false;
  }
}

export const isSocialPostUrl = (url: string | undefined) => !!url && SOCIAL.test(host(url));
export const isShortLink = (url: string) => SHORTENER.test(host(url));

/** The X status id in an x.com / twitter.com post URL. */
export function xStatusId(url: string | undefined): string | null {
  return url?.match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[^/]+\/status(?:es)?\/(\d+)/i)?.[1] ?? null;
}

/** The first form-like link in the texts, or null. */
export function pickFormLink(texts: (string | undefined)[]): string | null {
  return extractUrls(texts).find(isFormLike) ?? null;
}
