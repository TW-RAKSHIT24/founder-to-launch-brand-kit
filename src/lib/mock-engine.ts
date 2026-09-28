import type {
  Brand,
  CheckConsistencyResponse,
  ConsistencyCheck,
  ConsistencyFix,
  FounderData,
  GenericPhraseFinding,
  Messaging,
} from '@/lib/contracts';

const PALETTES = [
  ['#193E43', '#4D9B84', '#E0B76B'],
  ['#243A55', '#7A9FB5', '#E17A62'],
  ['#514538', '#AF8E61', '#A8B78E'],
] as const;

const DIRECTIONS = [
  { name: 'Fieldnote', descriptor: 'Grounded clarity', voice: 'Direct, observant, and quietly confident' },
  { name: 'Brightside', descriptor: 'Optimistic momentum', voice: 'Warm, practical, and encouraging' },
  { name: 'Goodform', descriptor: 'Thoughtful utility', voice: 'Clear, considered, and human' },
] as const;

const GENERIC_PHRASES = [
  { phrase: 'innovative solutions', replacement: 'a clearer way to work through the problem' },
  { phrase: 'game-changing', replacement: 'more useful' },
  { phrase: 'customer-centric', replacement: 'built around the people it serves' },
  { phrase: 'seamless experience', replacement: 'a simpler next step' },
];

function sentence(value: string): string {
  const trimmed = value.trim().replace(/[.!?]+$/, '');
  return trimmed.length > 92 ? `${trimmed.slice(0, 89).trimEnd()}...` : trimmed;
}

function boundedProposal(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

export function generateMockBrands(founderData: FounderData): Brand[] {
  const problem = sentence(founderData.problem);
  const customer = sentence(founderData.customer);
  const personality = sentence(founderData.personality);
  return DIRECTIONS.map((direction, index) => ({
    id: `sample-${index + 1}`,
    name: `${founderData.startupName.slice(0, 68).trimEnd()} / ${direction.name}`,
    descriptor: direction.descriptor,
    audience: customer,
    positioning: `${founderData.startupName} helps ${customer} move through ${problem}, with a ${direction.descriptor.toLowerCase()} approach shaped by ${personality.toLowerCase()}.`,
    voice: `${personality}, expressed in a ${direction.voice.toLowerCase()} way`,
    tagline: [
      'Make room for the work that matters.',
      'A better next step starts here.',
      'Useful by design. Human by nature.',
    ][index],
    mission: `Help ${customer} spend less energy on ${problem} and more on the work they care about.`,
    story: `${founderData.startupName} begins with a simple observation: ${problem}. It is being shaped for ${customer}, with a ${personality.toLowerCase()} point of view.`,
    valueProposition: `${founderData.startupName} brings innovative solutions to ${customer} who need a clearer way through ${problem}.`,
    elevatorPitch: `${founderData.startupName} is a customer-centric tool for ${customer}. It offers a seamless experience for ${problem}, with a practical approach instead of another game-changing promise.`,
    messagePillars: [
      `${direction.descriptor}: a clear point of view for ${customer}.`,
      `Useful progress: a simpler way to work through ${problem}.`,
      `Human by design: shaped around ${personality.toLowerCase()}.`,
    ],
    colors: [...PALETTES[index]],
    wordsToAvoid: ['revolutionary', 'world-class', 'game-changing', 'best-in-class'],
  }));
}

function replaceGenericPhrases(value: string, founderData: FounderData): { text: string; counts: Map<string, number> } {
  let text = value;
  const counts = new Map<string, number>();
  for (const item of GENERIC_PHRASES) {
    const expression = new RegExp(item.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.match(expression);
    if (matches?.length) {
      counts.set(item.phrase, (counts.get(item.phrase) ?? 0) + matches.length);
      const replacement = item.phrase === 'innovative solutions'
        ? `a clearer way through ${sentence(founderData.problem)}`
        : item.phrase === 'customer-centric'
          ? `built around ${sentence(founderData.customer)}`
          : item.replacement;
      text = text.replace(expression, replacement);
    }
  }
  return { text, counts };
}

export function refineMockMessaging(founderData: FounderData, selectedBrand: Brand): {
  messaging: Messaging;
  genericPhrasesFound: GenericPhraseFinding[];
} {
  const source: Messaging = {
    valueProposition: selectedBrand.valueProposition,
    elevatorPitch: selectedBrand.elevatorPitch,
    messagePillars: selectedBrand.messagePillars,
  };
  const totals = new Map<string, number>();
  const rewrite = (value: string): string => {
    const result = replaceGenericPhrases(value, founderData);
    for (const [phrase, count] of result.counts) totals.set(phrase, (totals.get(phrase) ?? 0) + count);
    return result.text;
  };
  const messaging = {
    valueProposition: rewrite(source.valueProposition),
    elevatorPitch: rewrite(source.elevatorPitch),
    messagePillars: source.messagePillars.map(rewrite),
  };
  const genericPhrasesFound = GENERIC_PHRASES.flatMap((item) => {
    const count = totals.get(item.phrase) ?? 0;
    if (count === 0) return [];
    const replacement = item.phrase === 'innovative solutions'
      ? `a clearer way through ${sentence(founderData.problem)}`
      : item.phrase === 'customer-centric'
        ? `built around ${sentence(founderData.customer)}`
        : item.replacement;
    return [{ phrase: item.phrase, count, replacement }];
  });
  return { messaging, genericPhrasesFound };
}

function includesInput(text: string, value: string): boolean {
  const words = value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  return words.length === 0 || words.some((word) => text.toLowerCase().includes(word));
}

function makeCheck(
  dimension: ConsistencyCheck['dimension'],
  aligned: boolean,
  passFinding: string,
  warningFinding: string,
  suggestion: string,
): ConsistencyCheck {
  return {
    dimension,
    status: aligned ? 'pass' : 'warning',
    finding: aligned ? passFinding : warningFinding,
    suggestion,
  };
}

export function checkMockConsistency(
  founderData: FounderData,
  selectedBrand: Brand,
  messaging: Messaging,
): CheckConsistencyResponse {
  const combined = `${selectedBrand.positioning} ${messaging.valueProposition} ${messaging.elevatorPitch} ${messaging.messagePillars.join(' ')}`;
  const audienceAligned = includesInput(combined, founderData.customer);
  const toneAligned = includesInput(`${selectedBrand.voice} ${selectedBrand.story}`, founderData.personality);
  const positioningAligned = includesInput(`${selectedBrand.positioning} ${messaging.valueProposition}`, founderData.problem);
  const taglineAligned = includesInput(`${selectedBrand.tagline} ${selectedBrand.voice}`, founderData.personality);
  const checks: ConsistencyCheck[] = [
    makeCheck('audience', audienceAligned, 'The message names the audience you described.', 'The audience is not explicit in the main message.', `Name ${founderData.customer} in the value proposition.`),
    makeCheck('tone', toneAligned, 'The voice reflects the personality you chose.', 'The voice does not yet reflect your stated personality.', `Bring more of this into the voice: ${founderData.personality}.`),
    makeCheck('positioning', positioningAligned, 'The positioning connects to the problem you described.', 'The problem is hard to find in the current positioning.', `Make the connection to this problem more direct: ${founderData.problem}.`),
    makeCheck('tagline-personality', taglineAligned, 'The tagline and voice share a consistent point of view.', 'The tagline could better reflect the chosen personality.', `Review the tagline against this personality: ${founderData.personality}.`),
  ];

  const fixes: ConsistencyFix[] = [];
  if (!audienceAligned) fixes.push({ id: 'fix-audience', path: 'valueProposition', currentValue: messaging.valueProposition, proposedValue: boundedProposal(`${messaging.valueProposition} Made for ${founderData.customer}.`, 500), reason: 'The intended audience is not explicit in the core value proposition.' });
  if (!toneAligned) fixes.push({ id: 'fix-tone', path: 'voice', currentValue: selectedBrand.voice, proposedValue: boundedProposal(`${selectedBrand.voice}, with ${founderData.personality.toLowerCase()} at its center`, 240), reason: 'The voice can state the founder-selected personality more clearly.' });
  if (!positioningAligned) fixes.push({ id: 'fix-positioning', path: 'positioning', currentValue: selectedBrand.positioning, proposedValue: boundedProposal(`${selectedBrand.positioning} Focused on ${founderData.problem}.`, 500), reason: 'The positioning should reconnect to the founder-described problem.' });
  if (!taglineAligned) fixes.push({ id: 'fix-tagline', path: 'tagline', currentValue: selectedBrand.tagline, proposedValue: boundedProposal(`${selectedBrand.tagline} For ${founderData.personality.toLowerCase()}.`, 120), reason: 'The tagline can carry more of the selected personality.' });
  return { checks, fixes, mode: 'mock' };
}
