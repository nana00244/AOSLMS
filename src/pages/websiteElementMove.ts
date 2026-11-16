import type { SchoolWebsitePage } from '../data';

export interface WebsiteElementMove {
  fromSectionId: string;
  elementId: string;
  toSectionId: string;
  /** Omit to append the element to the destination. */
  beforeElementId?: string;
}

export function moveWebsiteElement(
  page: SchoolWebsitePage,
  move: WebsiteElementMove,
): SchoolWebsitePage {
  const from = page.blocks.find((b) => b.id === move.fromSectionId);
  const to = page.blocks.find((b) => b.id === move.toSectionId);
  const source = from?.elements ?? [];
  const destination = to?.elements ?? [];
  const element = source.find((e) => e.id === move.elementId);
  if (!from || !to || !element || move.elementId === move.beforeElementId) return page;
  if (from !== to && destination.some((e) => e.id === element.id)) return page;
  const remaining = source.filter((e) => e.id !== element.id);
  const next = from === to ? remaining : [...destination];
  const index =
    move.beforeElementId === undefined
      ? next.length
      : next.findIndex((e) => e.id === move.beforeElementId);
  if (index < 0 || (from === to && index === source.indexOf(element))) return page;
  next.splice(index, 0, element);
  return {
    ...page,
    blocks: page.blocks.map((block) => {
      if (block === to) return { ...block, elements: next };
      if (block === from) return { ...block, elements: remaining };
      return block;
    }),
  };
}
