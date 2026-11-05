import type { NaccaQuestion } from './types';

// Preserve subjects, objects, direction, negation and quantities. Only words
// that do not change a proposition are discarded when comparing its terms.
function terms(text: string): string {
  return text
    .replace(/\b(?:a|an|the|basically|essentially|simply|actually|usually)\b/g, ' ')
    .replace(/\b(?:that is|which is)\b/g, ' ')
    .replace(/\b(?:is able to|are able to)\b/g, 'can')
    .replace(/\b(?:in order to)\b/g, 'to')
    .replace(/\b(?:for instance|for example)\b/g, ' ')
    .replace(/\b(?:in order that|so that)\b/g, 'so')
    .replace(/\b(?:because of|as a result of|due to)\b/g, 'because of')
    .replace(/\b(?:to make certain|to ensure)\b/g, 'to make sure')
    .replace(/\b(?:reduce|decrease|lower)\b/g, 'reduce')
    .replace(/\b(?:reduces|decreases|lowers)\b/g, 'reduces')
    .replace(/\b(?:produces|generates|makes)\b/g, 'produces')
    .replace(/\b(?:prevents|stops)\b/g, 'prevents')
    .replace(/\b(?:tiny|little|small)\b/g, 'small')
    .replace(/\b(?:moves around|revolves around|goes around)\b/g, 'orbits')
    .replace(/\b(?:everyday|daily)\b/g, 'daily')
    .replace(/\b(?:becomes|turns into)\b/g, 'becomes')
    .replace(/\b(?:receive|get|obtain)\b/g, 'get')
    .replace(/\b(?:assist|help)\b/g, 'help')
    .replace(/\b(?:larger|bigger)\b/g, 'larger')
    .replace(/\b(?:in motion|moving)\b/g, 'moving')
    .replace(/\b(?:utilises|utilizes)\b/g, 'uses')
    .replace(/\b(?:utilise|utilize)\b/g, 'use')
    .replace(/[,:;.!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function item(text: string): string {
  return terms(text)
    .replace(/\bleaves\b/g, 'leaf')
    .replace(
      /\b(?:roots|stems|flowers|trees|rivers|ponds|lungs|kidneys|switches|batteries)\b/g,
      (word) =>
        word === 'batteries' ? 'battery' : word === 'switches' ? 'switch' : word.slice(0, -1),
    )
    .replace(/^connecting wire$/, 'wire')
    .replace(/^typhoid fever$/, 'typhoid');
}

const exampleSets: [RegExp, string[]][] = [
  [
    /place you might see a (?:double bar )?graph outside of school/,
    ['weather report', 'news website', 'sports website', 'weather app', 'hospital', 'bank'],
  ],

  [/parts? of a plant/, ['fruit', 'seed', 'bud', 'branch']],
  [
    /appliances .*use electricity/,
    ['washing machine', 'electric cooker', 'microwave', 'freezer', 'computer', 'air conditioner'],
  ],
  [/examples of habitats/, ['forest', 'desert', 'ocean', 'pond', 'river', 'grassland', 'wetland']],
  [/mammals that live in water/, ['manatee', 'dugong', 'porpoise', 'orca']],
  [/living things that live on land/, ['horse', 'ant', 'lizard', 'sheep', 'chicken']],
];

function enumeration(stem: string, keys: string[], candidates: string[]): boolean | undefined {
  const prompt = stem.match(/^(?:name|list) (?:any )?(two|three) (.+)/);
  if (
    !prompt ||
    /\b(?:pairs|in order|and state|and explain|mixtures|ways to make)\b/.test(prompt[2])
  )
    return;
  const count = prompt[1] === 'two' ? 2 : 3;
  const split = (s: string) => s.split(/\s*(?:,\s*(?:and\s+)?|;|\band\b|&)\s*/).map(item);
  function distinctConcept(entry: string): string {
    if (/seed .* germinate/.test(stem)) {
      if (entry === 'moisture') return 'water';
      if (entry === 'air') return 'oxygen';
    }
    if (entry === 'person') return 'human';
    return entry;
  }
  const vocabulary = new Set(keys.flatMap(split).map(distinctConcept));
  for (const [pattern, examples] of exampleSets) {
    if (pattern.test(stem)) examples.forEach((example) => vocabulary.add(example));
  }
  return candidates.some((text) => {
    const items = split(text).map(distinctConcept);
    return (
      items.length >= count &&
      new Set(items).size >= count &&
      items.every((entry) => vocabulary.has(entry))
    );
  });
}

// A definition can be expressed using different words if it still states
// the required relationship. Patterns run against a complete answer clause.
const definitions: Record<string, RegExp[]> = {
  'what is a multiple': [
    /^(?:the |a )?(?:product|result) (?:you get )?(?:of|from|when) (?:multiplying |you multiply )?(?:a |one )?(?:given )?number (?:and|by|times) (?:a |any )?(?:whole number|integer)$/,
  ],
  'what is adaptation': [
    /^(?:a |an )?(?:trait|feature|characteristic)s? (?:that |which )?(?:helps?|allows?|enables?) (?:a |an )?(?:living things?|plants?|animals?|organisms?) (?:to )?(?:survive|live)(?: (?:in|within) (?:its|their|the) (?:habitat|environment))?$/,
  ],
  'what is a reversible change': [
    /^(?:when )?(?:you can (?:get|bring) (?:the )?(?:initial|original) (?:material|substance) back|(?:the |a )?(?:material|substance) can (?:go back|return) to its (?:initial|original) (?:state|form))$/,
  ],
  'what is the function of the windpipe': [
    /^(?:(?:the windpipe|it|this tube) )?(?:takes|transports|carries|conducts|moves) air (?:from (?:the )?(?:nose|throat|mouth) )?(?:to|into) (?:the |our )?lungs$/,
  ],
  'what is friction': [
    /^(?:it is )?(?:a |the )?force (?:that |which )?(?:resists|opposes|slows(?: down)?) (?:the )?(?:relative )?(?:motion|movement)(?: between (?:two )?(?:touching )?(?:objects|surfaces)(?: in contact)?)?$/,
  ],
  'what is a habitat': [
    /^(?:(?:the|a) )?(?:natural )?(?:place|environment|area|home) (?:where|in which|of) (?:a |an )?(?:organisms?|animals?|plants?|species|living things?)(?: (?:naturally )?(?:lives?|grows?|survives?)(?: naturally)?)?$/,
  ],
  'what is respiration': [
    /^(?:(?:the|a) )?(?:process (?:of|where|in which|by which) )?(?:cells? |living things |organisms? )?(?:release|releases|releasing|obtain|obtaining) energy (?:from|by breaking down) (?:food|glucose)(?: in (?:the )?cells)?$/,
  ],
  'what is energy transformation': [
    /^(?:when |the process of )?(?:energy (?:is )?(?:converted|changes|changing)|(?:converting|changing) energy) from one (?:form|type) (?:of energy )?(?:to|into) another(?: form| type)?$/,
  ],
  'what is ductility': [
    /^(?:(?:the ability of )?(?:a )?metal (?:can be|to be)|it can be) (?:pulled|stretched|drawn) into (?:a |thin |long )*(?:wire|wires)$/,
  ],
  'what is malleability': [
    /^(?:(?:the ability of )?(?:a )?metal (?:can be|to be)|it can be) (?:flattened|hammered|pressed|rolled) into (?:thin |flat )*sheets$/,
  ],
};

export function gradeByRequirements(
  question: NaccaQuestion,
  keys: string[],
  candidates: string[],
): boolean | undefined {
  const stem = question.stem.toLowerCase().replace(/[?.!]$/, '');
  if (/^(?:name|give|identify) (?:one|an?)(?: example of)? /.test(stem)) {
    for (const [pattern, examples] of exampleSets) {
      if (pattern.test(stem) && candidates.some((text) => examples.includes(item(text))))
        return true;
    }
  }
  const list = enumeration(stem, keys, candidates);
  if (list !== undefined) return list;

  // Quantities, comparisons, sequences and written number forms retain their
  // mathematical signs and order. Their ordinary answer frames are handled by the caller.
  if (keys.some((key) => /[\d+/<=>%°]/.test(key))) {
    const notation = (text: string) =>
      text
        .replace(/[−]/g, '-')
        .replace(/(?<=\d)\s*[×x*]\s*(?=\d)/g, '*')
        .replace(/÷/g, '/')
        .replace(/(?<=\d)\s*-\s*(?=\d)/g, '-')
        .replace(/\s*([<>=/+])\s*/g, '$1')
        .replace(/,\s+/g, ',');
    if (candidates.some((text) => keys.some((key) => notation(key) === notation(text))))
      return true;
    if (/comparison/.test(stem)) {
      return (
        candidates.some((text) => {
          const relation = notation(text).match(/^(-?\d+)([<>=])(-?\d+)$/);
          if (!relation) return false;
          const [, left, operator, right] = relation;
          const reverse = operator === '<' ? '>' : operator === '>' ? '<' : '=';
          return keys.some((key) => notation(key) === right + reverse + left);
        }) || undefined
      );
    }
    return;
  }

  const definition = stem.match(/^what (?:is|are) (.+)$/);
  const clauses = [...candidates];
  if (definition) {
    const subject = definition[1].replace(/^(?:an?|the) /, '');
    for (const text of candidates) {
      const bare = text.replace(/^(?:an?|the) /, '');
      for (const verb of [' is ', ' are ', ' means ', ' refers to ']) {
        if (bare.startsWith(subject + verb)) clauses.push(bare.slice(subject.length + verb.length));
      }
    }
  }
  // In a why-question the causal connective is supplied by the prompt.
  if (/^(?:why|(?:explain|give one reason) why)\b/.test(stem)) {
    const reason = (text: string) =>
      text.replace(/^(?:(?:this|that|it) is )?(?:because|since) /, '');
    keys = keys.map(reason);
    clauses.push(...clauses.map(reason));
  }
  // Substitute the named subject for a pronoun only when the prompt supplies it.
  // This lets a pupil write a full sentence without discarding who does what.
  const functionOf = stem.match(
    /(?:the (?:function|purpose|role|use) of |^why (?:is|are) )(?:the |a |an )?([a-z]+(?: [a-z]+){0,2}?)(?: in | important| used| needed|$)/,
  );
  if (functionOf) {
    const subject = functionOf[1];
    for (const clause of [...clauses]) {
      const bare = clause.replace(/^(?:the|a|an) /, '');
      if (bare.startsWith(subject + ' ')) clauses.push('it ' + bare.slice(subject.length + 1));
    }
  }
  const expected = new Set(keys.map(terms).filter(Boolean));
  return (
    clauses.some(
      (text) =>
        expected.has(terms(text)) || definitions[stem]?.some((pattern) => pattern.test(text)),
    ) || undefined
  );
}
