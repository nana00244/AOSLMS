import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { normalizeSchoolSite } from '../schoolWebsiteModel';
import { createSection, createSiteItem } from './siteTemplates';
import { SchoolSiteCanvas } from './SchoolSiteCanvas';
import { schoolLinkDestination } from './schoolSiteLinks';

describe('school website canvas', () => {
  it('renders gallery descriptions, FAQ answers and free elements on the visitor page', () => {
    const site = normalizeSchoolSite(undefined);
    const gallery = createSection('gallery');
    gallery.items = [
      { ...createSiteItem('Science class', 'Learning together'), image: '/campus.webp' },
    ];
    const faq = createSection('faq');
    const blank = createSection('blank');
    blank.elements = [
      { id: 'visit', kind: 'button', text: 'Plan a visit', url: '/school/contact', width: 'half' },
    ];
    site.pages.home.blocks = [gallery, faq, blank];
    const render = (editing: boolean) =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          {},
          createElement(SchoolSiteCanvas, {
            site,
            pageKey: 'home',
            onSelect: editing ? () => {} : undefined,
          }),
        ),
      );
    const publicPage = render(false);
    expect(publicPage).toContain('alt="Science class"');
    expect(publicPage).toContain('<figcaption>Learning together</figcaption>');
    expect(publicPage).toContain('<summary>How can we arrange a visit?');
    expect(publicPage).toContain('Plan a visit</a>');
    expect(publicPage).not.toContain('data-studio-id=');
    expect(render(true)).toContain('data-studio-id="hero"');
  });

  it('only links supported school, external, phone and email destinations', () => {
    expect(schoolLinkDestination('/school/academics')).toBe('/school/academics');
    expect(schoolLinkDestination('https://example.com/visit')).toBe('https://example.com/visit');
    expect(schoolLinkDestination('tel:+1234567')).toBe('tel:+1234567');
    expect(schoolLinkDestination('mailto:office@example.com')).toBe('mailto:office@example.com');
    for (const value of [
      '//example.com',
      '/\\example.com',
      'javascript:hello',
      'data:text/html,test',
    ]) {
      expect(schoolLinkDestination(value)).toBeUndefined();
    }
  });
});
