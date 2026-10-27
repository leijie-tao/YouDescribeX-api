// src/prompts/refinePresets.ts

// xiao1009 Preset list for RefineAD. One entry per button the describer can press. The frontend only
// ever sends the `id`, so wording can be changed here without releasing the frontend (decision 5B in
// refinead-v1-options.md). Adding a preset = append one entry to PRESETS below, nothing else:
// the id union, the id list and the lookup helper are all derived from that array.
//
// Leijie Phase 1 button set from refinead-button-pipeline.md: Make concise, Polish (merges the old
// Fix grammar) and four text-only Style options. Replaces shorten-to-fit, simplify, fix-grammar and
// keep-onscreen-text-verbatim; RefineAD has not shipped, so the old ids are dropped, not aliased.
//
// Output-format rules ("reply with only the description text", no markdown) deliberately live in the
// system prompt (refine.prompt.ts), not here, so that every preset shares one single set of rules.

// Leijie `lengthRatio` sets the LENGTH LIMIT the prompt shows: round(original words × ratio). It is a
// target for the model, not a check on the reply: returning the description unchanged is always
// allowed, and the only hard length guard is the character cap in refine.service.ts.
// `temperature` overrides the default in llm.util.ts when a preset needs the model to stay closer to
// the original wording.
// `requiresInstruction` marks a preset that only works with the describer's free text: the service
// answers 400 without it. Such a preset also counts the free text's words in its length limit, since
// what the describer typed is exactly what gets added.
export interface RefinePreset {
  id: string;
  label: string;
  lengthRatio: number;
  temperature?: number;
  requiresInstruction?: boolean;
  instruction: string;
}

// Leijie Ratios from refinead-button-pipeline.md section 3.1, kept as constants so they can be tuned
// after evaluation.
export const CONCISE_LENGTH_RATIO = 0.7;
export const POLISH_LENGTH_RATIO = 1.15;
export const STYLE_LENGTH_RATIO = 1.2;
// Leijie Applied to (original words + the describer's detail words): the details are added, nothing
// else is, so the sum is already the natural upper bound.
export const ADD_DETAILS_LENGTH_RATIO = 1;

// Leijie Every Style option shares one shell; only the name and the block of focus rules differ.
const buildStyleInstruction = (styleName: string, styleRules: string[]): string =>
  [
    `Rewrite this description with a ${styleName} emphasis.`,
    'This is a style change. The original is not wrong. Shift what comes first and what gets attention. Do not change the facts.',
    ...styleRules.map(rule => `- ${rule}`),
    'Rules:',
    '- Use only information from the current description and the context. If the description does not contain what this style needs, stay close to the original instead of inventing details.',
    '- Keep any on-screen text in quotation marks, exactly as written, even when it moves to a new position.',
    '- Never exceed the length limit.',
    '- Match the tone of the video. Consider its title and genre.',
  ].join('\n');

// xiao1009 Id convention (decision 5B): lower-case kebab-case, verb first, never renamed once shipped,
// new presets are appended. The frontend hard-codes the same ids in its own refinePresets.ts.
const PRESETS = [
  {
    id: 'make-concise',
    label: 'Make concise',
    lengthRatio: CONCISE_LENGTH_RATIO,
    instruction: [
      'Make this description concise. Keep only what a blind listener needs at this moment.',
      'Keep, in this priority order:',
      '1. Who is acting and the main action.',
      '2. Information needed to follow the story or the instructions.',
      '3. On-screen text.',
      '4. Names and key objects that later descriptions depend on.',
      'Remove first:',
      '- Details that do not change understanding: decorative adjectives, background clutter, camera language.',
      '- Explanations of what is already obvious from the action.',
      '- Anything the previous description already says.',
      'Aim for the length limit or fewer words. Never drop items 1 or 2 just to reach the number.',
      'If the description is already concise, make only small cuts or return it unchanged.',
    ].join('\n'),
  },
  {
    id: 'polish',
    label: 'Polish',
    lengthRatio: POLISH_LENGTH_RATIO,
    temperature: 0.2,
    instruction: [
      'Polish this description so it reads naturally and clearly when spoken aloud. Making it readable and natural comes first; fixing grammar comes second.',
      'Do:',
      '- Turn written-style sentences into clear spoken sentences: subject first, one main idea per sentence.',
      '- Change passive voice to active voice.',
      '- Replace a weak verb plus adverb with one precise verb. Example: "walks quickly" becomes "hurries".',
      '- Replace a pronoun with a name or noun when it is unclear who it refers to.',
      '- Use "a" when something first appears and "the" after that.',
      '- Fix grammar, spelling, and punctuation errors.',
      'Do not:',
      '- Add, remove, or change any information.',
      '- Replace technical or domain-specific terms with simpler words.',
      '- Make it noticeably longer than the original.',
    ].join('\n'),
  },
  // Leijie Text-only Add details (option B): the model cannot see the video and the AI draft's source
  // material is not stored, so the describer supplies the details and the model works them in.
  // Upgraded to frame-based detection in Phase 3.
  {
    id: 'add-details',
    label: 'Add details',
    lengthRatio: ADD_DETAILS_LENGTH_RATIO,
    requiresInstruction: true,
    instruction: [
      'Add the details given in the ADDITIONAL REQUEST to this description. They come from the describer, who can see the video, so treat them as facts.',
      '- Work every detail into the description in natural spoken sentences.',
      '- Place each detail next to the person, object, or action it belongs to.',
      '- Keep everything the description already says. If a detail contradicts it, follow the detail.',
      '- Add nothing beyond the description and the ADDITIONAL REQUEST. Do not add interpretation.',
      '- If not every detail fits within the length limit, keep the ones that matter most for following the video.',
    ].join('\n'),
  },
  {
    id: 'style-character-focus',
    label: 'Character focus',
    lengthRatio: STYLE_LENGTH_RATIO,
    instruction: buildStyleInstruction('character', [
      'Lead with the people: who they are, what they visibly look like when it matters to the story, and their facial expressions, body language, and reactions.',
      'Introduce a new character with a descriptor before the name, such as "a bearded man, Jack".',
      'Move setting details after the characters, or drop the ones that are not needed.',
    ]),
  },
  {
    id: 'style-action-focus',
    label: 'Action focus',
    lengthRatio: STYLE_LENGTH_RATIO,
    instruction: buildStyleInstruction('action', [
      'Lead with what happens: the actions in the order they occur, using precise verbs.',
      'Mention people mainly as the ones doing the actions. Drop appearance and setting details unless they are needed to understand the action.',
      'For instructional content, state the step first, then any detail needed to perform it.',
    ]),
  },
  {
    id: 'style-environment-focus',
    label: 'Environment focus',
    lengthRatio: STYLE_LENGTH_RATIO,
    instruction: buildStyleInstruction('environment', [
      'Lead with the setting: the location, the time of day, weather or lighting, key objects, and where things are placed in the space.',
      'Compare sizes and shapes to familiar objects when that helps.',
      'Then mention the people and the action briefly.',
    ]),
  },
  {
    id: 'style-simple-language',
    label: 'Simple language',
    lengthRatio: STYLE_LENGTH_RATIO,
    instruction: buildStyleInstruction('simple language', [
      'Use everyday words and short sentences that a child or a non-native English speaker can follow.',
      'Replace uncommon words with common ones.',
      'If a technical term is essential, keep it and add a few plain words that explain it.',
      'If an explanation would go over the length limit, keep the term and skip the explanation.',
      'No idioms or figures of speech.',
    ]),
  },
] as const;

// xiao1009 Derived from PRESETS, so a new entry widens the union automatically.
export type RefinePresetId = (typeof PRESETS)[number]['id'];

export const REFINE_PRESETS: readonly RefinePreset[] = PRESETS;

// xiao1009 Used by the controller to reject an unknown presetId with 400, and to name the valid ids in
// the error message.
export const REFINE_PRESET_IDS: readonly string[] = PRESETS.map(preset => preset.id);

export const getRefinePreset = (presetId: string): RefinePreset | undefined => REFINE_PRESETS.find(preset => preset.id === presetId);

export default REFINE_PRESETS;
