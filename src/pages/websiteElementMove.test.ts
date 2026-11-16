import { expect, it } from 'vitest';
import type { SchoolWebsiteElement, SchoolWebsitePage } from '../data';
import { createSection } from './siteTemplates';
import { moveWebsiteElement } from './websiteElementMove';

const element = (id: string): SchoolWebsiteElement => ({
  id,
  kind: 'heading',
  text: id,
  url: '',
  width: 'full',
});
const source = {
  ...createSection('blank'),
  id: 'a',
  elements: [element('1'), element('2'), element('3')],
};
const empty = { ...createSection('quote'), id: 'b' };
const page: SchoolWebsitePage = {
  eyebrow: '',
  title: '',
  intro: '',
  image: '',
  blocks: [source, empty],
};

it('reorders canvas elements without mutating the undo snapshot', () => {
  const reordered = moveWebsiteElement(page, {
    fromSectionId: 'a',
    elementId: '1',
    toSectionId: 'a',
    beforeElementId: '3',
  });
  expect(reordered.blocks[0].elements?.map((el) => el.id)).toEqual(['2', '1', '3']);
  expect(page.blocks[0].elements?.map((el) => el.id)).toEqual(['1', '2', '3']);
  expect(reordered.blocks[1]).toBe(empty);
});

it('moves an existing element into an empty section, and ignores stale or redundant targets', () => {
  const moved = moveWebsiteElement(page, { fromSectionId: 'a', elementId: '2', toSectionId: 'b' });
  expect(moved.blocks[1].elements).toEqual([source.elements[1]]);
  expect(moved.blocks[0].elements?.map((el) => el.id)).toEqual(['1', '3']);
  expect(moveWebsiteElement(moved, { fromSectionId: 'a', elementId: '2', toSectionId: 'b' })).toBe(
    moved,
  );
  expect(
    moveWebsiteElement(page, {
      fromSectionId: 'a',
      elementId: '1',
      toSectionId: 'a',
      beforeElementId: '2',
    }),
  ).toBe(page);
  expect(
    moveWebsiteElement(page, {
      fromSectionId: 'a',
      elementId: '1',
      toSectionId: 'b',
      beforeElementId: 'gone',
    }),
  ).toBe(page);
});
