import type { SchoolWebsiteBlock, SchoolWebsitePage, SchoolWebsiteContent } from './data';
const paths: Record<string, string> = {
  home: '/school',
  about: '/school/about',
  learning: '/school/academics',
  admissions: '/school/admissions',
  contact: '/school/contact',
};
export function schoolPagePath(key: string) {
  return Object.hasOwn(paths, key) ? paths[key] : '/school/' + key;
}
export function isBuiltInSchoolPage(key: string) {
  return Object.hasOwn(paths, key);
}

export function newPageKey(name: string, pages: SchoolWebsiteContent['pages']) {
  const key = name
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!name.trim()) return undefined;
  const base = key || 'page';
  let candidate = base;
  for (
    let suffix = 2;
    candidate in pages ||
    candidate === 'prototype' ||
    Object.values(paths).includes('/school/' + candidate);
    suffix++
  ) {
    candidate = base + '-' + suffix;
  }
  return candidate;
}

// JSONB can reorder object keys between a save and a reload.
export function siteVersion(value: unknown): string {
  return JSON.stringify(value ?? null, (_, entry) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.keys(entry)
            .sort()
            .map((key) => [key, entry[key]]),
        )
      : entry,
  );
}
const item = (title: string, body: string, detail = '') => ({
  id: crypto.randomUUID(),
  title,
  body,
  detail,
  icon: 'graduation',
  image: '',
});
const block = (
  kind: SchoolWebsiteBlock['kind'],
  title: string,
  body = '',
  eyebrow = '',
): SchoolWebsiteBlock => ({
  id: crypto.randomUUID(),
  kind,
  eyebrow,
  title,
  body,
  actionLabel: '',
  actionPath: '',
  image: '',
  items: [],
});
function createDefaults(): SchoolWebsiteContent {
  const page = (
    eyebrow: string,
    title: string,
    intro: string,
    blocks: SchoolWebsiteBlock[],
  ): SchoolWebsitePage => ({ eyebrow, title, intro, image: '', blocks });
  return {
    brandName: 'AYISATU OWEN',
    brandSubtitle: 'INTERNATIONAL SCHOOL',
    logo: '',
    topLineLeft: 'TECHIMAN · BONO EAST REGION, GHANA',
    topLineRight: '“DEEPER UNDERSTANDING”',
    footerNote: 'Techiman, Bono East Region, Ghana',
    lmsLabel: 'LMS portal',
    navigation: [
      { label: 'Home', path: '/school' },
      { label: 'Our school', path: '/school/about' },
      { label: 'Learning', path: '/school/academics' },
      { label: 'Admissions', path: '/school/admissions' },
      { label: 'Contact', path: '/school/contact' },
    ],
    pages: {
      home: page(
        'WELCOME TO AYISATU OWEN',
        'Curious minds. Confident futures.',
        'A community school in Techiman where every child is encouraged to explore, ask questions and grow with purpose.',
        [
          Object.assign(
            block(
              'cards',
              'A school that sees the whole child',
              'Knowledge opens doors. Understanding helps us walk through them.',
              'A JOURNEY THROUGH SCHOOL',
            ),
            {
              items: [
                item('Wonder starts here.', 'Day nursery & kindergarten', 'EARLY YEARS'),
                item('Foundations take root.', 'Literacy, numeracy & discovery', 'PRIMARY'),
                item('Ideas meet possibility.', 'Challenge, projects & preparation', 'JUNIOR HIGH'),
              ],
            },
          ),
          block(
            'text',
            'Rooted in community since 1997',
            'Ayisatu Owen International School is a private, non-denominational basic school serving children from nursery through junior high. Our motto, “Deeper Understanding,” guides a learning experience built around curiosity, strong foundations and the whole child.',
            'OUR STORY',
          ),
          block(
            'quote',
            'Deeper understanding.',
            'Our motto, and the way we think about every child’s education.',
          ),
          Object.assign(
            block(
              'cta',
              'Let’s talk about your child’s next chapter.',
              'We would love to welcome your family to our learning community.',
              'COME SAY HELLO',
            ),
            { actionLabel: 'Talk with our team', actionPath: '/school/admissions' },
          ),
        ],
      ),
      about: page(
        'OUR SCHOOL',
        'A place to belong, explore and become.',
        'Founded in 1997, Ayisatu Owen International School is a private, non-denominational basic school in Techiman, Ghana.',
        [
          block(
            'text',
            'A school shaped by community',
            'From its beginnings in Takofiano, the school has grown to serve learners across early childhood, primary and junior high. Families, educators and community partners share in each child’s progress.',
            'OUR BEGINNING',
          ),
          Object.assign(
            block(
              'cards',
              'What guides us',
              'We want children to understand ideas, connect them to life and keep asking thoughtful questions.',
            ),
            {
              items: [
                item(
                  'Whole-child growth',
                  'Academic foundations, creativity, confidence and care for others.',
                ),
                item(
                  'Learning together',
                  'Families, educators and community partners share in each child’s progress.',
                ),
                item(
                  'Room to discover',
                  'Clubs, projects and performances give interests room to flourish.',
                ),
              ],
            },
          ),
        ],
      ),
      learning: page(
        'LEARNING AT AYI',
        'Strong foundations. Wide horizons.',
        'Our basic school welcomes children from day nursery and kindergarten through primary and junior high school.',
        [
          Object.assign(block('cards', 'Every stage is a chance to grow.'), {
            items: [
              item(
                'Early years',
                'Play, language and discovery build a joyful foundation for lifelong learning.',
              ),
              item(
                'Primary',
                'Children grow in literacy, numeracy, science and the confidence to investigate.',
              ),
              item(
                'Junior high',
                'Subject learning, projects and preparation for the Basic Education Certificate Examination.',
              ),
            ],
          }),
          block(
            'text',
            'Make room for questions.',
            'Reading, science and maths expos, research projects, debate, sports, drama and cultural activities help students put learning into practice.',
            'LEARNING BEYOND THE TEXTBOOK',
          ),
        ],
      ),
      admissions: page(
        'JOIN OUR COMMUNITY',
        'Every great journey starts with a question.',
        'We welcome families interested in a caring, curious learning community in Techiman.',
        [
          block(
            'text',
            'Start a conversation',
            'Contact the school to ask about available places, school visits, age requirements and the application process.',
          ),
          Object.assign(block('cards', 'What happens next?'), {
            items: [
              item('Tell us about your child', 'Share the year group you are considering.'),
              item('Arrange a conversation', 'Learn about school life and ask questions.'),
              item(
                'Plan next steps',
                'The school team will guide you through the application process.',
              ),
            ],
          }),
          Object.assign(block('cta', 'Ready to get in touch?'), {
            actionLabel: 'Contact the school',
            actionPath: '/school/contact',
          }),
        ],
      ),
      contact: page(
        'GET IN TOUCH',
        'We’d love to hear from your family.',
        'For admissions, school information or a visit, reach out to the school team.',
        [
          Object.assign(block('cards', 'Contact the school'), {
            items: [
              item('Find us', 'Techiman, Bono East Region, Ghana'),
              item('Call the school', '+233 35 232 0415', 'Weekdays, 6:30 am–5:00 pm'),
              item('Plan a visit', 'Contact us to arrange a visit and discuss admissions.'),
            ],
          }),
        ],
      ),
    },
  };
}
export function normalizeSchoolSite(value: unknown): SchoolWebsiteContent {
  const migrated = createDefaults();
  if (value && typeof value === 'object' && 'pages' in value && 'navigation' in value) {
    const raw = value as Partial<SchoolWebsiteContent>;
    const pages = raw.pages && typeof raw.pages === 'object' ? raw.pages : {};
    const mergedPages = { ...migrated.pages } as SchoolWebsiteContent['pages'];
    for (const [key, candidate] of Object.entries(pages)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const basePage = migrated.pages[key] || {
        eyebrow: '',
        title: key,
        intro: '',
        image: '',
        blocks: [],
      };
      const pageValue = candidate as Partial<SchoolWebsitePage>;
      mergedPages[key] = {
        ...basePage,
        ...pageValue,
        blocks: Array.isArray(pageValue.blocks)
          ? pageValue.blocks.map((candidateBlock, index) => {
              const baseBlock = basePage.blocks[index] || block('text', '');
              const blockValue = candidateBlock as Partial<SchoolWebsiteBlock>;
              return {
                ...baseBlock,
                ...blockValue,
                items: Array.isArray(blockValue.items)
                  ? blockValue.items.map((candidateItem) => ({
                      id: crypto.randomUUID(),
                      title: '',
                      body: '',
                      detail: '',
                      icon: 'graduation',
                      image: '',
                      ...(candidateItem && typeof candidateItem === 'object' ? candidateItem : {}),
                    }))
                  : baseBlock.items,
              };
            })
          : basePage.blocks,
      };
    }
    return { ...migrated, ...raw, pages: mergedPages };
  }
  const legacy = value as
    | { headline?: string; intro?: string; about?: string; contact?: string; heroImage?: string }
    | undefined;
  if (legacy) {
    migrated.pages.home.title = legacy.headline || migrated.pages.home.title;
    migrated.pages.home.intro = legacy.intro || migrated.pages.home.intro;
    migrated.pages.home.image = legacy.heroImage || '';
    const aboutText = migrated.pages.about.blocks.find((b) => b.kind === 'text');
    if (aboutText && legacy.about) aboutText.body = legacy.about;
    const contactText = migrated.pages.contact.blocks[0]?.items[0];
    if (contactText && legacy.contact) contactText.body = legacy.contact;
  }
  return migrated;
}
