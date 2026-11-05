import { gradeByRequirements } from './shortAnswerRequirements.ts';
import type { NaccaQuestion } from './types';

// Each alternative is compared only against the current question's own keys.
const equivalents: [RegExp, string][] = [
  [
    /\b(?:famine|famines|food scarcity|food shortages|a lack of food|lack of food|not enough food|a shortage of food|shortage of food)\b/g,
    'food shortage',
  ],
  [/\b(?:illnesses|illness|diseases)\b/g, 'disease'],
  [
    /\b(?:people losing their homes|loss of homes|people are forced to leave their homes)\b/g,
    'displacement',
  ],
  [/\b(?:floods|a flood)\b/g, 'flooding'],
  [/\bdroughts\b/g, 'drought'],
  [/\b(?:rising temperatures|higher temperatures)\b/g, 'increased temperature'],
  [/\b(?:garbage|trash)\b/g, 'rubbish'],
  [/\b(?:vapors|vapours|vapor)\b/g, 'vapour'],
  [/\b(?:odorless|without a smell)\b/g, 'odourless'],
  [/\b(?:colorless|without colour)\b/g, 'colourless'],
  [/\b(?:flashlight|flashlights)\b/g, 'torch'],
  [/\b(?:cell phone|cellphone)\b/g, 'mobile phone'],
  [/\b(?:measuring tape)\b/g, 'tape measure'],
  [/\b(?:starvation|severe hunger|severe food shortage|widespread hunger)\b/g, 'food shortage'],
  [/\b(?:heat exhaustion|heatstroke|heat stroke)\b/g, 'heat stress'],
  [/\b(?:planting more trees|planting trees|plant more trees)\b/g, 'plant trees'],
  [/\b(?:cutting down trees|clearing forests)\b/g, 'deforestation'],
  [/\b(?:sun energy|energy from the sun)\b/g, 'solar energy'],
  [/\b(?:water droplets|tiny drops of water|small drops of water)\b/g, 'small water drops'],
  [/\b(?:gets rid of|takes away)\b/g, 'removes'],
  [/\b(?:moves around|revolves around)\b/g, 'orbits'],
  [/\b(?:measuring temperature|taking the temperature)\b/g, 'measuring the temperature'],
  [/\b(?:river water|water from a river)\b/g, 'water from the river'],
  [/\b(?:primary data|firsthand data|first-hand data)\b/g, 'first hand data'],
  [
    /\b(?:data you gathered yourself|data you collected yourself|information you collect yourself)\b/g,
    'data you collect yourself',
  ],
  [
    /\b(?:data gathered by another person|data collected by another person)\b/g,
    'data collected by someone else',
  ],
];

function normalized(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.!]+$/, '');
}

function concept(text: string): string {
  for (const [pattern, replacement] of equivalents) text = text.replace(pattern, replacement);
  return text.replace(/^(?:a|an|the) /, '');
}

export function matchesShortAnswer(question: NaccaQuestion, response: string): boolean {
  const keys = Array.isArray(question.answer) ? question.answer : [question.answer];
  const input = normalized(response);
  const candidates = [
    input,
    input.replace(/^(?:the answer is|my answer is|it is|it's|one example is|an example is) /, ''),
  ];
  const preamble = /^(?:(?:i think|i believe|in my opinion|for example|for instance)[, ]+)+/;
  if (preamble.test(input)) candidates.push(input.replace(preamble, ''));
  const stem = normalized(question.stem).replace(/\?$/, '');
  const request = stem.match(
    /^(?:name|state|give|list|identify|suggest|describe) (?:any |the )?(one|two|three|an?|some) (.+)$/,
  );
  if (request) {
    const topic = request[2].replace(/^(?:example|examples) of /, '');
    const label = topic.replace(/\byour\b/g, 'my');
    for (const text of [...candidates]) {
      for (const count of [request[1], 'the', 'a', 'an']) {
        for (const verb of [' is ', ' are ', ' include ', ' can be ']) {
          const frame = count + ' ' + label + verb;
          if (text.startsWith(frame)) candidates.push(text.slice(frame.length));
          const suffix = verb + count + ' ' + label;
          if (text.endsWith(suffix)) candidates.push(text.slice(0, -suffix.length));
        }
      }
    }
  }
  // Accept causal sentence frames only when the prompt actually asks for an effect.
  const effect = question.stem.toLowerCase().match(/\beffects? of (.+?)(?: on .+)?[?.!]?$/);
  if (effect) {
    const subjects = ['it', 'this', effect[1]];
    for (const subject of subjects) {
      for (const verb of [
        'causes',
        'can cause',
        'may cause',
        'leads to',
        'can lead to',
        'results in',
      ]) {
        const prefix = subject + ' ' + verb + ' ';
        if (input.startsWith(prefix)) candidates.push(input.slice(prefix.length));
      }
    }
    if (effect[1] === 'climate change' && /on humans/i.test(question.stem)) {
      const humanEffect = input.match(
        /^(?:people|humans|communities|families) (?:may |can |might )?(?:suffer from|experience|face) (.+)$/,
      );
      if (humanEffect) candidates.push(humanEffect[1]);
      const shortage = input.match(/^there (?:is|may be|can be) (.+)$/);
      if (shortage) candidates.push(shortage[1]);
    }
    candidates.push(input.replace(/^(?:one|an) effect is /, ''));
  }
  const keyTexts = keys.filter((key) => key != null).map((key) => normalized(String(key)));
  const requirementResult = gradeByRequirements(question, keyTexts, candidates);
  if (requirementResult !== undefined) {
    return requirementResult;
  }
  return keys.some((key) => {
    if (key == null) return false;
    const expected = normalized(String(key));
    if (!expected) return false;
    return candidates.some(
      (candidate) =>
        candidate === expected ||
        (/^[a-z]/.test(expected) && concept(candidate) === concept(expected)),
    );
  });
}
