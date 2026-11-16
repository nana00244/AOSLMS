/** Destinations accepted by the school site's navigation and action buttons. */
export function schoolLinkDestination(value: string | undefined) {
  const link = value?.trim();
  if (!link || /[\\\u0000-\u001f\u007f]/.test(link)) return undefined;
  if (link.startsWith('/') && !link.startsWith('//')) return link;
  if (/^(mailto:|tel:)/i.test(link)) return link;
  if (/^https?:\/\//i.test(link)) {
    try {
      return new URL(link).href;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
