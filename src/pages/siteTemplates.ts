import type { SchoolWebsiteBlock } from '../data';

type Kind = SchoolWebsiteBlock['kind'];
type Item = SchoolWebsiteBlock['items'][number];

export const sectionTemplates: { kind: Kind; label: string }[] = [
  { kind: 'blank', label: 'Blank section' },
  { kind: 'text', label: 'Text and image' },
  { kind: 'cards', label: 'Feature cards' },
  { kind: 'gallery', label: 'Photo gallery' },
  { kind: 'faq', label: 'Frequently asked questions' },
  { kind: 'quote', label: 'Quote' },
  { kind: 'cta', label: 'Call to action' },
  { kind: 'divider', label: 'Divider' },
];

export function createSiteItem(title = '', body = ''): Item {
  return { id: crypto.randomUUID(), title, body, image: '', detail: '', icon: 'graduation' };
}

export function createSection(kind: Kind): SchoolWebsiteBlock {
  const base = {
    id: crypto.randomUUID(),
    kind,
    eyebrow: '',
    title: '',
    body: '',
    image: '',
    actionLabel: '',
    actionPath: '',
    items: [],
  };
  switch (kind) {
    case 'blank':
      return base;
    case 'text':
      return { ...base, title: 'Our story' };
    case 'cards':
      return {
        ...base,
        title: 'Explore our school',
        items: [
          createSiteItem('Learning'),
          createSiteItem('School life'),
          createSiteItem('Community'),
        ],
      };
    case 'gallery':
      return { ...base, title: 'Life at school', items: [createSiteItem()] };
    case 'faq':
      return {
        ...base,
        title: 'Frequently asked questions',
        items: [
          createSiteItem(
            'How can we arrange a visit?',
            'Contact our school team to plan your visit.',
          ),
        ],
      };
    case 'quote':
      return { ...base, title: 'Deeper understanding.' };
    case 'cta':
      return {
        ...base,
        title: 'Get in touch',
        actionLabel: 'Contact our team',
        actionPath: '/school/contact',
      };
    case 'divider':
      return base;
  }
}
