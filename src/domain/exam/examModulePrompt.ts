import type { AiMessage } from '../ai/aiProvider';
import type { ExamModule } from './examTypes';
import type { CEFRLevel } from '../../../types';

export interface ModuleRepairContext {
  previousOutput: string;
  errors: string[];
}

const OBJECTIVE_SHAPE = {
  objectiveQuestions: [
    {
      id: 'string',
      partId: 'string',
      passage: 'string',
      prompt: 'string',
      options: ['string', 'string', 'string'],
      correctOptionIndex: 0,
      points: 1,
      explanation: 'string',
    },
  ],
};

const PRODUCTIVE_SHAPE = {
  productiveTasks: [
    {
      id: 'string',
      partId: 'string',
      moduleId: 'writing | speaking',
      prompt: 'string',
      context: 'string',
      minWords: 80,
      points: 20,
      rubric: ['string'],
    },
  ],
};

export function buildModuleMessages(
  level: CEFRLevel,
  module: ExamModule,
  repair?: ModuleRepairContext
): AiMessage[] {
  const isObjective = module.id === 'listening' || module.id === 'reading';
  const blueprint = {
    moduleId: module.id,
    germanLabel: module.germanLabel,
    durationMinutes: module.durationMinutes,
    parts: module.templateParts.map(part => ({
      id: part.id,
      title: part.title,
      taskFamily: part.taskFamily,
      answerFormat: part.answerFormat,
      questionCount: part.questionCount,
      maxPoints: part.maxPoints,
      criteria: part.criteria,
      promptGuidance: part.promptGuidance,
    })),
  };

  const rules = [
    `You generate original Goethe-Zertifikat ${level} simulator content for ONE module only: "${module.id}".`,
    'Create fresh content in the public exam task style. Never copy official model-test text verbatim.',
    'Every item must be unique within the module: no repeated prompts, passages, options, or tasks.',
    'Never output placeholder/scaffolding text such as "Option a aus dem Text", "Ein originaler ... Lesetext im Stil", "Aussage N: Die Aussage passt zum Text", "Audio script", or "Hoertext".',
    module.id === 'listening'
      ? 'For listening, "passage" is the hidden German audio script read aloud by TTS; the learner never sees it. The visible prompt and options must be concrete answers about that script.'
      : '',
    `Use exactly the part questionCount values from the blueprint. Return ONLY JSON of this shape: ${JSON.stringify(
      isObjective ? OBJECTIVE_SHAPE : PRODUCTIVE_SHAPE
    )}.`,
  ]
    .filter(Boolean)
    .join('\n');

  const messages: AiMessage[] = [
    { role: 'system', content: rules },
    { role: 'user', content: JSON.stringify({ level, module: blueprint }) },
  ];

  if (repair) {
    messages.push({
      role: 'user',
      content: [
        'Your previous output was invalid. Fix ONLY these problems and return corrected JSON of the same shape:',
        ...repair.errors.map(error => `- ${error}`),
        'Previous output:',
        repair.previousOutput,
      ].join('\n'),
    });
  }

  return messages;
}
