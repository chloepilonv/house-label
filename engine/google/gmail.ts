/**
 * Gmail compose links, no OAuth. press and promotion promise "drafts, never
 * sends", `gmail.compose` is a restricted scope, and a URL works with no
 * connection at all. The artist edits and presses send.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export interface Draft {
  to: string | string[];
  subject: string;
  body: string;
  cc?: string | string[];
  bcc?: string | string[];
}

const addresses = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(",") : (v ?? ""));

/**
 * A prefilled Gmail compose window. No `authuser=0`: pinning an index opens
 * the wrong account for some; Gmail's picker handles it.
 */
export function composeUrl(draft: Draft): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: addresses(draft.to),
    su: draft.subject,
    body: draft.body,
  });
  if (draft.cc) params.set("cc", addresses(draft.cc));
  if (draft.bcc) params.set("bcc", addresses(draft.bcc));
  return `https://mail.google.com/mail/?${params}`;
}

/**
 * The same draft as a `mailto:`, offered beside the Gmail link, never instead:
 * long bodies overflow some clients' URL limits.
 */
export function mailtoUrl(draft: Draft): string {
  const params = new URLSearchParams({ subject: draft.subject, body: draft.body });
  if (draft.cc) params.set("cc", addresses(draft.cc));
  if (draft.bcc) params.set("bcc", addresses(draft.bcc));
  return `mailto:${encodeURIComponent(addresses(draft.to))}?${params}`;
}
