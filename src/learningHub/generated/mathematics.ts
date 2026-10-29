import type { HubLesson, HubQuestion } from '../catalog';

/** Original, deterministic items. These banks cover only the listed indicator facets.
 * PDF page numbers are one-based file pages, not printed page numbers.
 * Never infer exhaustive curriculum coverage from this module's grade range.
 */
type BankSpec = {
  code: string;
  page: number;
  title: string;
  scope: string;
  body: string[];
  make: (index: number) => HubQuestion;
};
const lower =
  'https://mingycomputersgh.wordpress.com/wp-content/uploads/2019/08/maths-lower-primary-b1-b3.pdf';
const upper =
  'https://mingycomputersgh.wordpress.com/wp-content/uploads/2019/08/maths-upper-primary-b4-b6.pdf';
const junior =
  'https://mingycomputersgh.wordpress.com/wp-content/uploads/2023/10/mathematics-1.pdf';
const text = (n: number) => String(Number(n.toFixed(6)));

function item(
  index: number,
  prompt: string,
  answer: string | number,
  wrong: (string | number)[],
  explanation: string,
): HubQuestion {
  const correct = String(answer);
  const distractors = [...new Set(wrong.map(String))].filter((value) => value !== correct);
  if (distractors.length < 3) throw new Error(`Insufficient distinct distractors: ${prompt}`);
  // Stable stored choices; the session engine shuffles these and remaps the key on every attempt.
  return {
    id: `v${index + 1}`,
    prompt,
    options: [correct, ...distractors.slice(0, 3)],
    answer: 0,
    explanation,
  };
}
function numeric(
  index: number,
  prompt: string,
  answer: number,
  explanation: string,
  candidates: number[] = [],
  nonnegative = false,
): HubQuestion {
  const choices = [...candidates, answer + 1, answer - 1, answer + 2, answer + 10];
  return item(
    index,
    prompt,
    text(answer),
    choices.filter((value) => !nonnegative || value >= 0).map(text),
    explanation,
  );
}

function counting(code: string, page: number, steps: number[], bound: number): BankSpec {
  return {
    code,
    page,
    title: `Count forwards and backwards to ${bound}`,
    scope: `Missing terms in forward/backward sequences with steps ${steps.join(', ')}; does not assess estimating physical collections.`,
    body: [
      'A counting rule tells you how much to add or subtract each time. Find the change between neighbouring terms before filling a gap.',
      'For 20, 30, 40, the step is +10. Counting backwards from 40 by tens gives 40, 30, 20. A missing middle term must fit the rule on both sides.',
      'Use counters, a number line or bundles to explain the rule. Check your answer by continuing one more step, without changing the step size.',
    ],
    make(i) {
      const step = steps[i % steps.length];
      const start = step * (1 + Math.floor(i / steps.length));
      const backwards = i % 2 === 1;
      const first = backwards ? start + 3 * step : start;
      const delta = backwards ? -step : step;
      const answer = first + 2 * delta;
      return numeric(
        i,
        `Count ${backwards ? 'backwards' : 'forwards'} by ${step}: ${first}, ${first + delta}, __, ${first + 3 * delta}. What is missing?`,
        answer,
        `The rule is ${backwards ? 'subtract' : 'add'} ${step}. From ${first + delta}, ${backwards ? 'subtract' : 'add'} ${step} to get ${answer}. The next number is ${first + 3 * delta}.`,
        [answer + step, answer - step, first],
      );
    },
  };
}
function compare(code: string, page: number, scale: number): BankSpec {
  return {
    code,
    page,
    title: 'Compare whole numbers using place value',
    scope: 'Comparing two whole numbers using <, > and =; ordering longer lists is not assessed.',
    body: [
      'Compare the highest place first. If those digits match, move one place to the right until the digits differ.',
      'The sign > means greater than, < means less than, and = means equal to. For example, 42 > 24 because four tens is greater than two tens.',
      'Equal quantities can have different descriptions. Read the full quantity before comparing it. Check a comparison by reading the sentence aloud.',
    ],
    make(i) {
      const a = (i + 2) * scale + 3,
        b = i % 3 === 0 ? a : a + (i % 2 === 0 ? 1 : -1) * ((i % 7) + 1);
      const sign = a === b ? '=' : a > b ? '>' : '<';
      return item(
        i,
        `Which comparison is correct?`,
        `${a} ${sign} ${b}`,
        [
          `${a} ${sign === '>' ? '<' : '>'} ${b}`,
          `${a} ${sign === '=' ? '<' : '='} ${b}`,
          `${a} + ${b} = ${a}`,
        ],
        `${a} is ${sign === '=' ? 'equal to' : sign === '>' ? 'greater than' : 'less than'} ${b}. Compare the place values from left to right; the correct sign is ${sign}.`,
      );
    },
  };
}
function addSubtract(code: string, page: number, scale: number, bound: number): BankSpec {
  return {
    code,
    page,
    title: `Addition and subtraction within ${bound}`,
    scope:
      'Whole-number calculations, missing addends and take-away stories; decimal operations and physical modelling are not assessed.',
    body: [
      'Addition joins quantities. Subtraction finds what is left or the difference between quantities. Keep ones with ones and tens with tens when using written methods.',
      bound === 20
        ? 'For 7 + 5, count five more after seven: 8, 9, 10, 11, 12. So 7 + 5 = 12. Taking five away from twelve leaves seven.'
        : 'For 37 + 25, combine 30 + 20 and 7 + 5 to get 50 + 12 = 62. For 62 − 25, you can subtract 20, then 5, to get 37.',
      'An unknown addend can be found by subtracting the known part from the total. Check subtraction with addition: the amount left plus the amount removed should equal the starting amount.',
    ],
    make(i) {
      const a = scale === 1 ? 2 + (i % 9) : scale * (i + (bound > 9999 ? 12 : 2)) + 7;
      const b = scale === 1 ? 1 + Math.floor(i / 9) : scale * ((i % 7) + 1) + 3;
      if (i % 4 === 0)
        return numeric(
          i,
          `Find ${a} + ${b}.`,
          a + b,
          `${a} + ${b} = ${a + b}. Joining the two quantities gives ${a + b}.`,
          [a - b, a + b + 1, a + b - 1],
          true,
        );
      if (i % 4 === 1)
        return numeric(
          i,
          `Find ${a + b} − ${b}.`,
          a,
          `${a + b} − ${b} = ${a}. Check: ${a} + ${b} = ${a + b}.`,
          [a + 2 * b, b, a - 1],
          true,
        );
      if (i % 4 === 2)
        return numeric(
          i,
          `Fill the gap: ${a} + __ = ${a + b}.`,
          b,
          `Subtract the known part from the total: ${a + b} − ${a} = ${b}.`,
          [a, a + b, a + 2 * b],
          true,
        );
      return numeric(
        i,
        `A class has ${a + b} counters. It puts ${b} counters away. How many remain?`,
        a,
        `Take away ${b} from ${a + b}: ${a + b} − ${b} = ${a}.`,
        [a + 2 * b, b, a + b],
        true,
      );
    },
  };
}
function rounding(code: string, page: number): BankSpec {
  return {
    code,
    page,
    title: 'Round whole numbers to a chosen place',
    scope:
      'Nearest rounding to tens, hundreds, thousands and ten-thousands within 100,000; directed rounding up/down is not assessed.',
    body: [
      'Rounding replaces a number with a nearby multiple of a chosen place value. Locate the multiples immediately below and above the number.',
      'To round 3,472 to the nearest hundred, compare 3,400 and 3,500. The halfway point is 3,450, so 3,472 rounds to 3,500.',
      'When the number is exactly halfway, use the usual school convention of choosing the greater multiple. Always state the place you rounded to: rounding to tens and to thousands can give different results.',
    ],
    make(i) {
      const unit = [10, 100, 1000, 10000][i % 4];
      const n =
        (1 + Math.floor(i / 4)) * unit +
        Math.round([0.21, 0.67, 0.5, 0.49, 0.51, 0.81, 0.19, 0.73][Math.floor(i / 4)] * unit);
      const answer = Math.round(n / unit) * unit;
      const low = Math.floor(n / unit) * unit,
        high = low + unit;
      return numeric(
        i,
        `Round ${n} to the nearest ${unit}.`,
        answer,
        `The neighbouring multiples are ${low} and ${high}. Their halfway point is ${low + unit / 2}. ${n} rounds to ${answer}.`,
        [low, high, answer + unit, answer - unit],
      );
    },
  };
}
function multiplyFacts(): BankSpec {
  return {
    code: 'B4.1.2.1.1',
    page: 35,
    title: 'Multiplication facts up to 12 × 12',
    scope: 'Equal groups, arrays described in words and missing-factor facts up to 12 × 12.',
    body: [
      'Multiplication counts equal groups. Four groups of six contain 4 × 6 = 24 objects. In an array, rows and columns show the two factors.',
      'Use a known fact to find a new one. Since 5 × 8 = 40, one more group of eight gives 6 × 8 = 48. Swapping factors does not change the product.',
      'To find a missing factor, use division or a multiplication fact you know. In 7 × __ = 42, the missing factor is 6 because 7 × 6 = 42.',
    ],
    make(i) {
      const a = 2 + (i % 8),
        b = 2 + Math.floor(i / 8) * 2;
      if (i % 3 === 0)
        return numeric(
          i,
          `There are ${a} rows of ${b} beads. How many beads are there?`,
          a * b,
          `${a} equal rows of ${b} beads give ${a} × ${b} = ${a * b}.`,
          [a + b, a * (b + 1), (a - 1) * b],
        );
      if (i % 3 === 1)
        return numeric(
          i,
          `Find ${a} × ${b}.`,
          a * b,
          `Add ${b} a total of ${a} times, or use a known multiplication fact: ${a} × ${b} = ${a * b}.`,
          [a + b, a * (b + 1), (a - 1) * b],
        );
      return numeric(
        i,
        `Find the missing factor: ${a} × __ = ${a * b}.`,
        b,
        `${a * b} ÷ ${a} = ${b}, so the missing factor is ${b}.`,
        [a, a * b, b + 2],
      );
    },
  };
}
function powersOfTen(code: string, page: number): BankSpec {
  return {
    code,
    page,
    title: 'Multiply and divide by powers of ten',
    scope:
      'Whole numbers and terminating decimals multiplied/divided by 10, 100 and 1000; benchmark fractions are not yet included.',
    body: [
      'Multiplying by 10 makes every digit worth ten times as much. Dividing by 10 makes each digit worth one tenth as much. Keep the decimal point aligned with the ones place.',
      'For example, 4.26 × 100 = 426, while 426 ÷ 100 = 4.26. Use zeros when a place is empty; do not simply delete a decimal point.',
      'Estimate first: multiplication by a power of ten greater than 1 increases a positive number, while division decreases it. Reverse the operation to check your answer.',
    ],
    make(i) {
      const a = (i + 11) / 10,
        factor = 10 ** (1 + (i % 3)),
        divide = i % 2 === 1,
        answer = divide ? a / factor : a * factor;
      return numeric(
        i,
        `Calculate ${a} ${divide ? '÷' : '×'} ${factor}.`,
        answer,
        `${divide ? 'Divide' : 'Multiply'} each place value by ${factor}: ${a} ${divide ? '÷' : '×'} ${factor} = ${text(answer)}. ${divide ? 'Multiplying' : 'Dividing'} the result by ${factor} returns ${a}.`,
        [divide ? a * factor : a / factor, a, answer * 10, answer / 10],
      );
    },
  };
}
function mentalFacts(code: string, page: number): BankSpec {
  return {
    code,
    page,
    title: 'Use known facts to multiply mentally',
    scope:
      'Deriving facts up to 81 by adding one group, subtracting one group, or doubling a known product; related division and other mental strategies are not assessed.',
    body: [
      'A known multiplication fact can help you work out another fact without starting again. One more group means adding the size of one group.',
      'If 4 × 7 = 28, then 5 × 7 = 28 + 7 = 35. If 6 × 7 = 42, then 5 × 7 = 42 − 7 = 35.',
      'Doubling the number of groups doubles the product. Since 3 × 8 = 24, six groups of eight contain 24 + 24 = 48. Explain why the strategy works before calculating.',
    ],
    make(i) {
      const a = 2 + (i % 4),
        b = 2 + Math.floor(i / 4),
        product = a * b;
      if (i % 3 === 0)
        return numeric(
          i,
          `You know ${a} × ${b} = ${product}. Use one more group to find ${a + 1} × ${b}.`,
          (a + 1) * b,
          `Add one group of ${b}: ${product} + ${b} = ${(a + 1) * b}.`,
          [product + 1, product + a, product - b],
        );
      if (i % 3 === 1)
        return numeric(
          i,
          `You know ${a} × ${b} = ${product}. Use one fewer group to find ${a - 1} × ${b}.`,
          (a - 1) * b,
          `Remove one group of ${b}: ${product} − ${b} = ${(a - 1) * b}.`,
          [product - 1, product + a, product + b],
        );
      const half = 1 + (i % 4);
      return numeric(
        i,
        `You know ${half} × ${b} = ${half * b}. Double the groups to find ${half * 2} × ${b}.`,
        half * 2 * b,
        `Double the product: ${half * b} + ${half * b} = ${half * 2 * b}.`,
        [half * b + 2, half * b + b, half * b],
      );
    },
  };
}
function substitute(code: string, page: number, advanced = false): BankSpec {
  return {
    code,
    page,
    title: advanced
      ? 'Evaluate expressions with squares and fractions'
      : 'Substitute values in algebraic expressions',
    scope: advanced
      ? 'Substitution into ax² + b and (ax + b)/c with integer results; other rational expressions are not covered.'
      : 'Substitution into linear expressions ax + b, including negative x.',
    body: [
      'Substitution means replacing each letter with its given value. Write brackets around a negative value so the signs remain clear.',
      'For 3x + 4 when x = −2, calculate 3(−2) + 4 = −6 + 4 = −2. Multiplication comes before addition.',
      'For squares, calculate the power before multiplying. In 2x² with x = −3, x² = 9, so 2x² = 18. When dividing an entire expression, work out the numerator first.',
    ],
    make(i) {
      const x = i - 12,
        a = 2 + (i % 5),
        b = 3 + (i % 7);
      if (advanced && i % 2 === 0) {
        const answer = a * x * x + b;
        return numeric(
          i,
          `Evaluate ${a}x² + ${b} when x = ${x}.`,
          answer,
          `First square ${x}: (${x})² = ${x * x}. Then ${a} × ${x * x} + ${b} = ${answer}.`,
          [a * x + b, (a * x) ** 2 + b, a * x * x - b],
        );
      }
      if (advanced) {
        const c = 2 + (i % 3),
          answer = a * x + b;
        return numeric(
          i,
          `Evaluate (${a * c}x + ${b * c})/${c} when x = ${x}.`,
          answer,
          `The numerator is ${a * c} × (${x}) + ${b * c} = ${answer * c}. Dividing all of it by ${c} gives ${answer}.`,
          [answer * c, a * c * x + b, answer + c],
        );
      }
      const answer = a * x + b;
      return numeric(
        i,
        `Evaluate ${a}x + ${b} when x = ${x}.`,
        answer,
        `Replace x with ${x}: ${a} × (${x}) + ${b} = ${a * x} + ${b} = ${answer}.`,
        [a + x + b, a * x - b, (a + b) * x],
      );
    },
  };
}
function equations(): BankSpec {
  return {
    code: 'B7.2.3.1.4',
    page: 76,
    title: 'Solve one-variable linear equations',
    scope:
      'Two-step equations ax + b = c with positive integer coefficients and integer solutions.',
    body: [
      'An equation states that two expressions have the same value. Preserve that balance by doing the same operation to both sides.',
      'To solve 4x + 3 = 23, subtract 3 from both sides to get 4x = 20. Divide both sides by 4 to get x = 5.',
      'Check by substituting the solution into the original equation: 4(5) + 3 = 23. Undo addition before undoing multiplication.',
    ],
    make(i) {
      const x = i - 8,
        a = 2 + (i % 7),
        b = 3 + (i % 9),
        c = a * x + b;
      return numeric(
        i,
        `Solve ${a}x + ${b} = ${c}. What is x?`,
        x,
        `Subtract ${b}: ${a}x = ${c - b}. Divide by ${a}: x = ${x}. Check: ${a}(${x}) + ${b} = ${c}.`,
        [c - b, c / a, c + b],
      );
    },
  };
}
function unitRates(): BankSpec {
  return {
    code: 'B8.1.4.1.2',
    page: 135,
    title: 'Unit price and constant speed',
    scope:
      'Unit-price and constant-speed calculations with exact whole-number results; conversions between speed units are not included.',
    body: [
      'A unit rate compares a quantity with one unit of another quantity. Divide the total cost by the number of items to find the cost per item.',
      'If five identical pens cost GH₵20, the unit price is 20 ÷ 5 = GH₵4 per pen. The units explain what the result means.',
      'At constant speed, distance = speed × time. A cyclist travelling 36 km in 3 hours has speed 12 km/h. Check that time and distance units are consistent.',
    ],
    make(i) {
      const rate = 4 + i,
        quantity = 2 + (i % 7),
        total = rate * quantity;
      return i % 2 === 0
        ? numeric(
            i,
            `${quantity} identical exercise books cost GH₵${total}. What is the cost of one book in Ghana cedis?`,
            rate,
            `Unit price = total cost ÷ quantity = ${total} ÷ ${quantity} = GH₵${rate} per book.`,
            [total, rate + quantity, total + quantity],
          )
        : numeric(
            i,
            `A cyclist travels ${total} km in ${quantity} hours at constant speed. What is the speed in km/h?`,
            rate,
            `Speed = distance ÷ time = ${total} ÷ ${quantity} = ${rate} km/h.`,
            [total, total * quantity, rate + quantity],
          );
    },
  };
}
function surds(): BankSpec {
  return {
    code: 'B9.1.2.4.3',
    page: 200,
    title: 'Simplify square-root surds',
    scope:
      'Extracting a square factor from positive integer square roots; products, quotients and sums of surds are not included.',
    body: [
      'A square-root surd stays exact when it is written with a root sign. To simplify it, find the largest perfect-square factor inside the root.',
      'For √72, write 72 = 36 × 2. Then √72 = √36 × √2 = 6√2. The remaining 2 has no square factor greater than 1.',
      'Check by squaring: (6√2)² = 36 × 2 = 72. Do not split a root across addition: √(a + b) is not generally √a + √b.',
    ],
    make(i) {
      const outside = 2 + Math.floor(i / 4),
        inside = [2, 3, 5, 7][i % 4],
        radicand = outside * outside * inside;
      return item(
        i,
        `Simplify √${radicand}.`,
        `${outside}√${inside}`,
        [`${outside * outside}√${inside}`, `${outside + 1}√${inside}`, `${outside - 1}√${inside}`],
        `${radicand} = ${outside * outside} × ${inside}. Therefore √${radicand} = √${outside * outside} × √${inside} = ${outside}√${inside}.`,
      );
    },
  };
}
function percentages(): BankSpec {
  return {
    code: 'B9.1.4.1.2',
    page: 205,
    title: 'Discounts and simple interest',
    scope:
      'Single-discount final prices and simple interest/final amounts; tax, insurance and multistep proportional problems are not included.',
    body: [
      'A percentage is a fraction out of 100. A discount reduces a price: discount = original price × rate/100, then final price = original price − discount.',
      'For a GH₵200 item with a 15% discount, the reduction is GH₵30 and the final price is GH₵170. The discount itself is different from the amount paid.',
      'Simple interest is I = Prt/100, where P is principal, r is the annual percentage rate and t is time in years. Total amount is P + I. These exercises use stated hypothetical rates, not current financial offers.',
    ],
    make(i) {
      const p = 100 * (i + 2),
        rate = 5 * (1 + (i % 4)),
        years = 1 + (i % 3);
      if (i % 2 === 0) {
        const discount = (p * rate) / 100;
        return numeric(
          i,
          `A bag costs GH₵${p}. A ${rate}% discount is offered. What is the final price in Ghana cedis?`,
          p - discount,
          `Discount = ${p} × ${rate}/100 = ${discount}. Final price = ${p} − ${discount} = GH₵${p - discount}.`,
          [discount, p + discount, p - rate],
        );
      }
      const interest = (p * rate * years) / 100;
      return numeric(
        i,
        `In a simple-interest exercise, GH₵${p} earns ${rate}% per year for ${years} years. What is the interest in Ghana cedis?`,
        interest,
        `I = Prt/100 = ${p} × ${rate} × ${years}/100 = GH₵${interest}. This is interest only, not principal plus interest.`,
        [p + interest, (p * rate) / 100, interest + rate],
      );
    },
  };
}

const specs: BankSpec[] = [
  counting('B1.1.1.1.1', 23, [1, 2], 100),
  compare('B1.1.1.1.5', 25, 2),
  addSubtract('B1.1.2.1.1', 27, 1, 20),
  counting('B2.1.1.1.1', 41, [2, 5, 10], 1000),
  compare('B2.1.1.1.6', 44, 2),
  addSubtract('B2.1.2.1.1', 45, 2, 100),
  counting('B3.1.1.1.1', 63, [10, 50, 100, 500, 1000], 10000),
  compare('B3.1.1.1.4', 66, 200),
  addSubtract('B3.1.2.1.1', 69, 10, 1000),
  compare('B4.1.1.1.4', 26, 200),
  counting('B4.1.1.1.6', 28, [50, 100], 10000),
  multiplyFacts(),
  compare('B5.1.1.1.4', 78, 2000),
  rounding('B5.1.1.1.5', 79),
  counting('B5.1.1.1.6', 80, [500, 1000], 100000),
  mentalFacts('B5.1.2.1.1', 86),
  compare('B6.1.1.1.4', 138, 2500),
  rounding('B6.1.1.1.5', 139),
  mentalFacts('B6.1.2.1.1', 144),
  powersOfTen('B7.1.2.1.1', 37),
  addSubtract('B7.1.2.2.1', 39, 100, 9999),
  substitute('B7.2.2.1.4', 69),
  equations(),
  powersOfTen('B8.1.2.1.1', 124),
  addSubtract('B8.1.2.2.1', 125, 1000, 999999),
  substitute('B8.2.2.1.3', 149, true),
  unitRates(),
  powersOfTen('B9.1.2.1.1', 198),
  surds(),
  percentages(),
];
export const mathematicsIndicatorCoverage = specs.map((spec) => ({
  subject: 'Mathematics',
  level: spec.code.split('.')[0],
  indicator: spec.code,
  page: spec.page,
  assessedScope: spec.scope,
  coverage: 'partial-indicator' as const,
  questionCount: 32,
}));
export const generatedMathematicsLessons: HubLesson[] = specs.map((spec) => {
  const grade = Number(spec.code[1]);
  return {
    id: `nacca-math-${spec.code.toLowerCase().replaceAll('.', '-')}`,
    title: spec.title,
    subject: 'Mathematics',
    level: `B${grade}`,
    strand: spec.code.split('.')[1] === '2' ? 'Algebra' : 'Number',
    standard: spec.code,
    description: spec.scope,
    body: spec.body,
    sourceUrl: grade <= 3 ? lower : grade <= 6 ? upper : junior,
    sourceTitle: `NaCCA Mathematics ${grade <= 3 ? 'B1–B3' : grade <= 6 ? 'B4–B6' : 'B7–B9'}, PDF page ${spec.page}`,
    questions: Array.from({ length: 32 }, (_, index) => spec.make(index)),
  };
});
