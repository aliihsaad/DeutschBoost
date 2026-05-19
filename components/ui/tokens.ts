export const SKILL_COLORS = {
  grammar: 'skill-grammar',
  vocabulary: 'skill-vocabulary',
  listening: 'skill-listening',
  reading: 'skill-reading',
  writing: 'skill-writing',
  speaking: 'skill-speaking',
} as const;

export type SkillKey = keyof typeof SKILL_COLORS;
