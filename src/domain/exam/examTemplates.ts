import type {
  ExamCriterionDefinition,
  ExamModule,
  ExamModuleId,
  ExamModuleTemplatePart,
  ExamTemplateSource,
  GoetheExam,
} from './examTypes';
import { CEFRLevel } from '../../../types';

export const LEVELS: CEFRLevel[] = [
  CEFRLevel.A1,
  CEFRLevel.A2,
  CEFRLevel.B1,
  CEFRLevel.B2,
  CEFRLevel.C1,
  CEFRLevel.C2,
];

export const MODULE_ORDER: ExamModuleId[] = ['listening', 'reading', 'writing', 'speaking'];

export type ExamModuleTemplateSpec = Pick<
  ExamModule,
  'id' | 'germanLabel' | 'englishLabel' | 'durationMinutes' | 'parts' | 'instructions' | 'templateParts'
>;

export interface GoetheExamTemplate {
  templateName: string;
  officialSources: ExamTemplateSource[];
  sourceNotes: string[];
  modules: ExamModuleTemplateSpec[];
}

const GOETHE_INFO_BASE = 'https://www.goethe.de/ins/us/en/spr/prf';

const SHARED_SOURCE_NOTES = [
  'Goethe-Institut public exam pages describe the official skill modules, durations, and exam format used here.',
  'Goethe accessible model-test pages are used as structure references for module parts and answer formats.',
  'Generated tasks are original simulator content based on public exam structure, not copied official exam papers.',
  'Pass target is kept at 60% per module for the simulator result gate.',
];

export const EXAM_TEMPLATES: Record<CEFRLevel, GoetheExamTemplate> = {
  [CEFRLevel.A1]: template(CEFRLevel.A1, 'Start Deutsch 1', 'gzsd1.cfm', [
    source('A1 exam overview', `${GOETHE_INFO_BASE}/gzsd1.cfm`, 'Official Goethe-Institut A1 sections and timing.'),
    source('A1 exam administration terms', 'https://www.goethe.de/pro/relaunch/prf/en/Durchfuehrungsbestimmungen_A1_Start_Deutsch_1.pdf', 'Official A1 terms for parts and whole-exam score calculation.'),
    source('A1 reading model structure', 'https://bfu.goethe.de/a1_sd1/lesen.php', 'Public accessible A1 model-test reading parts.'),
    source('A1 speaking model structure', 'https://bfu.goethe.de/a1_sd1/sprechen.php', 'Public accessible A1 model-test speaking parts.'),
  ], [
    spec('listening', 'Hoeren', 'Listening', 20, 'Answer short everyday conversations, telephone messages, and public announcements.', [
      part('teil-1', 'Teil 1', 'Short everyday conversations', 'right / wrong or three-option multiple choice', 6, 'Create brief audio scripts from daily public or private situations.'),
      part('teil-2', 'Teil 2', 'Telephone messages or announcements', 'three-option multiple choice', 4, 'Use slow, clear language and one concrete detail per item.'),
      part('teil-3', 'Teil 3', 'Public loudspeaker announcements', 'three-option multiple choice', 5, 'Ask for practical details such as time, place, price, or action.'),
    ]),
    spec('reading', 'Lesen', 'Reading', 25, 'Read short notes, ads, information signs, notices, and simple messages.', [
      part('teil-1', 'Teil 1', 'Short letters or personal messages', 'right / wrong', 5, 'Use simple personal notes with explicit factual statements.'),
      part('teil-2', 'Teil 2', 'Advertisements or short public texts', 'three-option multiple choice', 5, 'Use notices, ads, or sign-like texts with one clear purpose.'),
      part('teil-3', 'Teil 3', 'Information signs and notices', 'three-option multiple choice', 5, 'Test whether the learner can identify where an action is possible or forbidden.'),
    ]),
    spec('writing', 'Schreiben', 'Writing', 20, 'Complete a simple form and write a short personal text about an everyday situation.', [
      part('teil-1', 'Teil 1', 'Form completion', 'short fields', 5, 'Ask for basic personal information using a simple form context.', {
        maxPoints: 5,
        criteria: singleCriterion('form-fields', 'Form fields', 5),
      }),
      part('teil-2', 'Teil 2', 'Short personal message', 'short free text', 1, 'Require a brief everyday message with three content points.', {
        maxPoints: 10,
        criteria: productiveCriteria([3, 2, 3, 2]),
      }),
    ]),
    spec('speaking', 'Sprechen', 'Speaking', 15, 'Introduce yourself, ask and answer everyday questions, and make a simple request.', [
      part('teil-1', 'Teil 1', 'Self introduction', 'spoken response', 1, 'Prompt name, age, country, residence, languages, job, and hobby.', {
        maxPoints: 3,
        criteria: singleCriterion('self-introduction', 'Self introduction', 3),
      }),
      part('teil-2', 'Teil 2', 'Ask for and give information', 'spoken interaction', 1, 'Use everyday topic cards such as food, travel, work, or family.', {
        maxPoints: 6,
        criteria: singleCriterion('question-answer', 'Question and answer', 6),
      }),
      part('teil-3', 'Teil 3', 'Make and respond to requests', 'spoken interaction', 1, 'Use polite requests and short responses in familiar situations.', {
        maxPoints: 6,
        criteria: singleCriterion('request-response', 'Request and response', 6),
      }),
    ]),
  ]),
  [CEFRLevel.A2]: template(CEFRLevel.A2, 'A2', 'gzsd2.cfm', [
    source('A2 exam overview', `${GOETHE_INFO_BASE}/gzsd2.cfm`, 'Official Goethe-Institut A2 sections and timing.'),
    source('A2 exam administration terms', 'https://www.goethe.de/pro/relaunch/prf/en/Durchfuehrungsbestimmungen_A2.pdf', 'Official A2 terms for parts, 25-point sections, and whole-exam pass gates.'),
    source('A2 listening model structure', 'https://bfu.goethe.de/a2_mod_2MX5/hoeren.php', 'Public accessible A2 model-test listening parts.'),
    source('A2 reading model structure', 'https://bfu.goethe.de/a2_mod_2MX5/lesen.php', 'Public accessible A2 model-test reading parts.'),
    source('A2 writing model structure', 'https://bfu.goethe.de/a2_mod_2MX5/schreiben.php', 'Public accessible A2 model-test writing parts.'),
  ], [
    spec('listening', 'Hoeren', 'Listening', 30, 'Answer everyday conversations, radio announcements, phone messages, and public announcements.', [
      part('teil-1', 'Teil 1', 'Radio or everyday broadcast item', 'three-option multiple choice', 5, 'Use one continuous practical text with five detail questions.'),
      part('teil-2', 'Teil 2', 'Short conversations', 'matching or multiple choice', 5, 'Use brief everyday exchanges with concrete details.'),
      part('teil-3', 'Teil 3', 'Answering-machine or phone message', 'three-option multiple choice', 5, 'Use voicemail-style scripts about appointments or changes.'),
      part('teil-4', 'Teil 4', 'Public announcements', 'right / wrong or multiple choice', 5, 'Use announcements in stations, shops, schools, or offices.'),
    ]),
    spec('reading', 'Lesen', 'Reading', 30, 'Read short articles, emails, advertisements, and public information-board notices.', [
      part('teil-1', 'Teil 1', 'Short newspaper or web article', 'a / b / c multiple choice', 5, 'Use a short factual text with five direct comprehension items.'),
      part('teil-2', 'Teil 2', 'Email or personal message', 'right / wrong or multiple choice', 5, 'Test practical meaning and intent.'),
      part('teil-3', 'Teil 3', 'Advertisements or web listings', 'matching', 5, 'Match people or needs to suitable ads.'),
      part('teil-4', 'Teil 4', 'Public notices or information boards', 'short answer / matching', 5, 'Use concise notices and ask where/when/what applies.'),
    ]),
    spec('writing', 'Schreiben', 'Writing', 30, 'Write an SMS and an email related to immediate everyday needs.', [
      part('teil-1', 'Teil 1', 'SMS message', '20-30 words', 1, 'Give three bullet points: apologize, explain, propose a new plan.', {
        maxPoints: 10,
        criteria: productiveCriteria([3, 2, 3, 2]),
      }),
      part('teil-2', 'Teil 2', 'Email message', '30-40 words', 1, 'Use a familiar everyday situation with three required content points.', {
        maxPoints: 10,
        criteria: productiveCriteria([3, 2, 3, 2]),
      }),
    ]),
    spec('speaking', 'Sprechen', 'Speaking', 15, 'Ask and answer personal questions, tell something about your life, and plan something together.', [
      part('teil-1', 'Teil 1', 'Questions about the person', 'spoken interaction', 1, 'Use four personal-topic cards.', {
        maxPoints: 5,
        criteria: singleCriterion('questions', 'Questions about the person', 5),
      }),
      part('teil-2', 'Teil 2', 'Tell about own life', 'spoken monologue', 1, 'Prompt a short personal description with simple reasons.', {
        maxPoints: 10,
        criteria: singleCriterion('monologue', 'Tell about own life', 10),
      }),
      part('teil-3', 'Teil 3', 'Plan together', 'spoken interaction', 1, 'Use a shared plan such as a trip, course party, or appointment.', {
        maxPoints: 10,
        criteria: singleCriterion('planning', 'Plan together', 10),
      }),
    ]),
  ]),
  [CEFRLevel.B1]: template(CEFRLevel.B1, 'B1', 'gzb1.cfm', [
    source('B1 exam overview', 'https://www.goethe.de/ins/us/en/m/spr/prf/gzb1.cfm', 'Official Goethe-Institut B1 modules and timing.'),
    source('B1 listening model structure', 'https://bfu.goethe.de/b1_mod/hoeren.php', 'Public accessible B1 model-test listening parts.'),
    source('B1 reading model structure', 'https://bfu.goethe.de/b1_mod/lesen.php', 'Public accessible B1 model-test reading parts.'),
    source('B1 writing model structure', 'https://bfu.goethe.de/b1_mod/schreiben.php', 'Public accessible B1 model-test writing tasks and criteria.'),
    source('B1 speaking model structure', 'https://bfu.goethe.de/b1_mod/sprechen.php', 'Public accessible B1 model-test speaking tasks.'),
    source('B1 result ratings', 'https://www.goethe.de/en/m/spr/prf/pes/pab1.html', 'Official Goethe-Institut B1 result ratings and 60-point module pass threshold.'),
    source('B1 exam administration terms', 'https://www.goethe.de/resources/files/pdf315/durchfuehrungsbestimmungen-goethe-zertifikat-b1-erwachsene-und-jugendliche-v2.pdf', 'Official B1 terms for module timing, part structure, and score calculation.'),
  ], [
    spec('listening', 'Hoeren', 'Listening', 40, 'Answer announcements, short talks, informal conversations, and radio-style discussions.', [
      part('teil-1', 'Teil 1', 'Announcements and short messages', 'right / wrong and multiple choice', 10, 'Use practical audio scripts with one clear situation each.', { maxPoints: 10 }),
      part('teil-2', 'Teil 2', 'Short lecture or report', 'three-option multiple choice', 5, 'Use one coherent talk with detail questions.', { maxPoints: 5 }),
      part('teil-3', 'Teil 3', 'Informal conversation', 'right / wrong', 7, 'Use a natural two-speaker conversation about everyday plans.', { maxPoints: 7 }),
      part('teil-4', 'Teil 4', 'Radio discussion', 'matching opinions', 8, 'Give multiple speaker opinions and ask who says what.', { maxPoints: 8 }),
    ]),
    spec('reading', 'Lesen', 'Reading', 65, 'Read blog posts, emails, newspaper articles, advertisements, and written instructions.', [
      part('teil-1', 'Teil 1', 'Blog post / longer informational text', 'right / wrong or a / b / c', 6, 'Use a semi-formal text with six direct comprehension tasks.', { maxPoints: 6 }),
      part('teil-2', 'Teil 2', 'Press text with opinion/detail questions', 'a / b / c multiple choice', 6, 'Use one newspaper-style text and ask detail/opinion questions.', { maxPoints: 6 }),
      part('teil-3', 'Teil 3', 'Short notices and advertisements', 'matching people to notices', 7, 'Match people with needs to suitable offers; include one distractor.', { maxPoints: 7 }),
      part('teil-4', 'Teil 4', 'Matching statements to opinions', 'matching', 7, 'Use short opinions from several people and ask who expresses each view.', { maxPoints: 7 }),
      part('teil-5', 'Teil 5', 'Instructions or rules text', 'a / b / c multiple choice', 4, 'Use a regulation, school rule, or instruction sheet.', { maxPoints: 4 }),
    ]),
    spec('writing', 'Schreiben', 'Writing', 60, 'Write a forum opinion and a personal or formal message.', [
      part('teil-1', 'Teil 1', 'Personal or semi-formal email', 'free text', 1, 'Require three content points, greeting, structure, and closing.', { maxPoints: 40, criteria: productiveCriteria([10, 10, 10, 10]) }),
      part('teil-2', 'Teil 2', 'Forum post expressing opinion', 'free text', 1, 'Ask for opinion, reasons, examples, and a short conclusion.', { maxPoints: 40, criteria: productiveCriteria([10, 10, 10, 10]) }),
      part('teil-3', 'Teil 3', 'Formal short message', 'free text', 1, 'Require a formal apology or request in a concise message.', { maxPoints: 20, criteria: productiveCriteria([4, 4, 6, 6]) }),
    ]),
    spec('speaking', 'Sprechen', 'Speaking', 15, 'Plan something, present a topic, and discuss the presentation.', [
      part('teil-1', 'Teil 1', 'Plan something together', 'spoken interaction', 1, 'Give a realistic shared planning problem with constraints.', { maxPoints: 28, criteria: speakingCriteria([8, 4, 8, 8]) }),
      part('teil-2', 'Teil 2', 'Presentation on a current topic', 'spoken monologue', 1, 'Offer two topic choices with bullet prompts.', { maxPoints: 40, criteria: speakingCriteria([12, 4, 12, 12]) }),
      part('teil-3', 'Teil 3', 'Questions and feedback', 'spoken interaction', 1, 'Ask follow-up questions about the learner presentation.', { maxPoints: 16, criteria: [{ id: 'fulfillment', label: 'Erfuellung', maxPoints: 16 }] }),
      part('pronunciation', 'Aufgabe 1, 2, 3', 'Pronunciation across the oral module', 'examiner criterion', 1, 'Assess pronunciation globally across all speaking tasks.', { maxPoints: 16, criteria: [{ id: 'pronunciation', label: 'Aussprache', maxPoints: 16 }] }),
    ]),
  ]),
  [CEFRLevel.B2]: template(CEFRLevel.B2, 'B2', 'gzb2.cfm', [
    source('B2 exam overview', `${GOETHE_INFO_BASE}/gzb2.cfm`, 'Official Goethe-Institut B2 modules and timing.'),
    source('B2 exam administration terms', 'https://www.goethe.de/pro/relaunch/prf/en/Durchfuehrungsbestimmungen_B2.pdf', 'Official B2 terms for module point calculation and pass threshold.'),
    source('B2 listening model structure', 'https://bfu.goethe.de/b2_mod_2MX6/hoeren.php', 'Public accessible B2 model-test listening parts.'),
    source('B2 reading model structure', 'https://bfu.goethe.de/b2_mod_2MX6/lesen.php', 'Public accessible B2 model-test reading parts.'),
    source('B2 writing model structure', 'https://bfu.goethe.de/b2_mod_2MX6/schreiben.php', 'Public accessible B2 model-test writing parts.'),
  ], [
    spec('listening', 'Hoeren', 'Listening', 40, 'Answer interviews, lectures, conversations, statements, and radio-style material.', [
      part('teil-1', 'Teil 1', 'Five short conversations and statements', 'right / wrong plus multiple choice', 10, 'Use five short audio scripts, two tasks each.'),
      part('teil-2', 'Teil 2', 'Interview or longer conversation', 'multiple choice', 6, 'Use one longer interview with detailed comprehension.'),
      part('teil-3', 'Teil 3', 'Informational talk or lecture', 'multiple choice', 6, 'Use one structured talk with key-detail questions.'),
      part('teil-4', 'Teil 4', 'Discussion with several speakers', 'matching opinions', 8, 'Use a panel-style discussion and ask who holds each view.'),
    ]),
    spec('reading', 'Lesen', 'Reading', 65, 'Read forum posts, articles, comments, regulations, and longer opinion texts.', [
      part('teil-1', 'Teil 1', 'Forum opinions from several people', 'matching statements to people', 9, 'Use four people and nine statements.'),
      part('teil-2', 'Teil 2', 'Article with sentence gaps', 'gap matching', 6, 'Use a coherent article and sentence-bank gaps.'),
      part('teil-3', 'Teil 3', 'Newspaper or magazine article', 'a / b / c multiple choice', 6, 'Use abstract but concrete topic text with detailed items.'),
      part('teil-4', 'Teil 4', 'Short opinions or comments', 'matching headings/statements', 6, 'Use short viewpoints with one distractor.'),
      part('teil-5', 'Teil 5', 'Regulations or formal information', 'a / b / c multiple choice', 3, 'Use official-style rules or conditions.'),
    ]),
    spec('writing', 'Schreiben', 'Writing', 75, 'Write a forum post and a formal professional message.', [
      part('teil-1', 'Teil 1', 'Forum post on a social issue', 'minimum 150 words', 1, 'Require opinion, reasons, alternatives, advantages, introduction, and conclusion.', {
        maxPoints: 60,
        criteria: productiveCriteria([15, 15, 15, 15]),
      }),
      part('teil-2', 'Teil 2', 'Formal email/message in professional context', 'minimum 100 words', 1, 'Require four content points in appropriate order and register.', {
        maxPoints: 40,
        criteria: productiveCriteria([10, 10, 10, 10]),
      }),
    ]),
    spec('speaking', 'Sprechen', 'Speaking', 15, 'Give a short presentation and discuss arguments with a partner.', [
      part('teil-1', 'Teil 1', 'Short presentation', 'spoken monologue plus questions', 1, 'Offer two topics; require alternatives, pros/cons, and evaluation.', {
        maxPoints: 50,
        criteria: speakingCriteria([15, 10, 15, 10]),
      }),
      part('teil-2', 'Teil 2', 'Discussion', 'spoken interaction', 1, 'Use a controversial question with pro/con prompts.', {
        maxPoints: 50,
        criteria: speakingCriteria([15, 10, 15, 10]),
      }),
    ]),
  ]),
  [CEFRLevel.C1]: template(CEFRLevel.C1, 'C1', 'gzc1.cfm', [
    source('C1 exam overview', `${GOETHE_INFO_BASE}/gzc1.cfm`, 'Official Goethe-Institut C1 modules and timing.'),
    source('C1 exam administration terms', 'https://www.goethe.de/pro/relaunch/prf/en/Durchfuehrungsbestimmungen_C1.pdf', 'Official C1 terms for module points and 30-checkpoint objective conversion.'),
    source('C1 accessible model structure', 'https://bfu.goethe.de/c1mod/', 'Public accessible C1 model-test module parts.'),
  ], [
    spec('listening', 'Hoeren', 'Listening', 40, 'Answer podcast, interview, discussion, and lecture tasks.', [
      part('teil-1', 'Teil 1', 'Podcast with matching statements', 'matching', 6, 'Use a podcast about books, culture, science, or society.'),
      part('teil-2', 'Teil 2', 'Interview', 'multiple choice', 9, 'Use a structured interview with detailed opinions.'),
      part('teil-3', 'Teil 3', 'Discussion', 'matching opinions', 8, 'Use several speakers and distinguish nuanced views.'),
      part('teil-4', 'Teil 4', 'Lecture', 'multiple choice', 7, 'Use an academic-style talk with details and inference.'),
    ]),
    spec('reading', 'Lesen', 'Reading', 65, 'Read long articles with main ideas, viewpoints, implicit meaning, and details.', [
      part('teil-1', 'Teil 1', 'Cloze article', 'gap choice', 8, 'Use a cohesive article and ask for the correct gap choices.'),
      part('teil-2', 'Teil 2', 'Article with sentence gaps', 'gap matching', 7, 'Use cohesive devices and sentence insertion.'),
      part('teil-3', 'Teil 3', 'Opinion article', 'multiple choice', 8, 'Ask for stance, inference, and detail.'),
      part('teil-4', 'Teil 4', 'Short expert comments', 'matching speakers and statements', 7, 'Use several short texts and nuanced matching.'),
    ]),
    spec('writing', 'Schreiben', 'Writing', 75, 'Write a forum discussion contribution and a formal message with suitable tone and register.', [
      part('teil-1', 'Teil 1', 'Forum discussion contribution', 'developed free text', 1, 'Require explanation, argumentation, examples, and conclusion.', {
        maxPoints: 60,
        criteria: productiveCriteria([15, 15, 15, 15]),
      }),
      part('teil-2', 'Teil 2', 'Formal message', 'free text', 1, 'Require appropriate register and a clear practical purpose.', {
        maxPoints: 40,
        criteria: productiveCriteria([10, 10, 10, 10]),
      }),
    ]),
    spec('speaking', 'Sprechen', 'Speaking', 20, 'Present a complex topic and discuss a controversial topic.', [
      part('teil-1', 'Teil 1', 'Short lecture on a complex topic', 'spoken monologue plus questions', 1, 'Require structured argument, examples, and personal stance.', {
        maxPoints: 50,
        criteria: speakingCriteria([15, 10, 15, 10]),
      }),
      part('teil-2', 'Teil 2', 'Controversial discussion', 'spoken interaction', 1, 'Require argument exchange and response to counterarguments.', {
        maxPoints: 50,
        criteria: speakingCriteria([15, 10, 15, 10]),
      }),
    ]),
  ]),
  [CEFRLevel.C2]: template(CEFRLevel.C2, 'C2', 'gzc2.cfm', [
    source('C2 exam overview', `${GOETHE_INFO_BASE}/gzc2.cfm`, 'Official Goethe-Institut C2 modules and timing.'),
    source('C2 exam administration terms', 'https://www.goethe.de/pro/relaunch/prf/en/Durchfuehrungsbestimmungen_C2_neu.pdf', 'Official C2 terms for modular 100-point scoring.'),
    source('C2 listening model structure', 'https://bfu.goethe.de/c2_mod/hoeren.php', 'Public accessible C2 model-test listening tasks and weighted points.'),
    source('C2 reading model structure', 'https://bfu.goethe.de/c2_mod/lesen.php', 'Public accessible C2 model-test reading tasks.'),
    source('C2 speaking model structure', 'https://bfu.goethe.de/c2_mod/sprechen.php', 'Public accessible C2 model-test speaking tasks.'),
  ], [
    spec('listening', 'Hoeren', 'Listening', 35, 'Answer media reports, informal conversations, and expert interviews at natural speed.', [
      part('aufgabe-1', 'Aufgabe 1', 'Radio-report excerpts', 'yes / no', 15, 'Use several short radio excerpts and precise factual claims.', { maxPoints: 30 }),
      part('aufgabe-2', 'Aufgabe 2', 'Two-person discussion', 'speaker matching', 5, 'Use a complex discussion with speaker-specific opinions.', { maxPoints: 20 }),
      part('aufgabe-3', 'Aufgabe 3', 'Expert interview', 'multiple choice', 10, 'Use specialized but accessible expert speech.', { maxPoints: 50 }),
    ]),
    spec('reading', 'Lesen', 'Reading', 80, 'Read complex factual texts, comments, reports, and advertisements with implicit viewpoints.', [
      part('aufgabe-1', 'Aufgabe 1', 'Long comment', 'a / b / c / d multiple choice', 10, 'Use a dense opinion text with inference-heavy questions.', { maxPoints: 40 }),
      part('aufgabe-2', 'Aufgabe 2', 'Article sections', 'matching statements', 6, 'Use abstract report sections and match claims.', { maxPoints: 18 }),
      part('aufgabe-3', 'Aufgabe 3', 'Text with gaps', 'gap matching', 6, 'Use cohesive and rhetorical structure.', { maxPoints: 18 }),
      part('aufgabe-4', 'Aufgabe 4', 'Short factual texts or ads', 'matching', 8, 'Use high-level scanning and implicit requirements.', { maxPoints: 24 }),
    ]),
    spec('writing', 'Schreiben', 'Writing', 80, 'Rephrase parts of a short presentation and write a structured letter to the editor or review.', [
      part('aufgabe-1', 'Aufgabe 1', 'Reformulation task', 'controlled rewriting', 10, 'Use fixed words that must not be changed.', {
        maxPoints: 20,
        criteria: singleCriterion('reformulation', 'Reformulation accuracy', 20),
      }),
      part('aufgabe-2', 'Aufgabe 2', 'Letter to the editor or review', 'about 350 words', 1, 'Offer several topics and require a polished structured response.', {
        maxPoints: 80,
        criteria: extendedProductiveCriteria([16, 16, 16, 16, 16]),
      }),
    ]),
    spec('speaking', 'Sprechen', 'Speaking', 15, 'Give a lecture on a complex topic and defend nuanced arguments in discussion.', [
      part('aufgabe-1', 'Aufgabe 1', 'Complex lecture', 'spoken monologue plus questions', 1, 'Offer two topics with quotations or contrasting viewpoints.', {
        maxPoints: 50,
        criteria: speakingCriteria([15, 10, 15, 10]),
      }),
      part('aufgabe-2', 'Aufgabe 2', 'Pro/con discussion', 'spoken interaction', 1, 'Require defending a position and responding to counterarguments.', {
        maxPoints: 50,
        criteria: speakingCriteria([15, 10, 15, 10]),
      }),
    ]),
  ]),
};

export interface ExamBlueprintInput {
  level: CEFRLevel;
  now?: () => string;
  idFactory?: () => string;
}

export function createExamBlueprint(input: ExamBlueprintInput): GoetheExam {
  const level = LEVELS.includes(input.level) ? input.level : CEFRLevel.B1;
  const now = input.now ?? (() => new Date().toISOString());
  const idFactory =
    input.idFactory ?? (() => `exam-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const examTemplate = EXAM_TEMPLATES[level];
  const modules = examTemplate.modules.map(moduleSpec => ({
    ...moduleSpec,
    objectiveQuestions: [],
    productiveTasks: [],
  }));

  return {
    id: idFactory(),
    title: `DeutschBoost Goethe-style ${level} Simulator`,
    templateName: examTemplate.templateName,
    level,
    generatedAt: now(),
    totalMinutes: modules.reduce((sum, module) => sum + module.durationMinutes, 0),
    passThreshold: 60,
    officialSources: [...examTemplate.officialSources],
    sourceNotes: [...examTemplate.sourceNotes],
    modules,
  };
}

function template(
  level: CEFRLevel,
  certificateName: string,
  overviewPath: string,
  officialSources: ExamTemplateSource[],
  modules: ExamModuleTemplateSpec[]
): GoetheExamTemplate {
  const overviewUrl = overviewPath.startsWith('http') ? overviewPath : `${GOETHE_INFO_BASE}/${overviewPath}`;

  return {
    templateName: `Goethe-Zertifikat ${certificateName} public model-test profile`,
    officialSources: officialSources.some(sourceItem => sourceItem.url === overviewUrl)
      ? officialSources
      : [
          source(`${level} exam overview`, overviewUrl, `Official Goethe-Institut ${level} sections and timing.`),
          ...officialSources,
        ],
    sourceNotes: [
      `Template follows the public Goethe-Zertifikat ${certificateName} overview and accessible model-test task families.`,
      ...SHARED_SOURCE_NOTES,
    ],
    modules,
  };
}

function source(label: string, url: string, note: string): ExamTemplateSource {
  return { label, url, note };
}

function part(
  id: string,
  title: string,
  taskFamily: string,
  answerFormat: string,
  questionCount: number,
  promptGuidance: string,
  options: {
    maxPoints?: number;
    scoringNote?: string;
    criteria?: ExamCriterionDefinition[];
  } = {}
): ExamModuleTemplatePart {
  return {
    id,
    title,
    taskFamily,
    answerFormat,
    questionCount,
    promptGuidance,
    maxPoints: options.maxPoints,
    scoringNote: options.scoringNote,
    criteria: options.criteria,
  };
}

function productiveCriteria(maxPoints: [number, number, number, number]): ExamCriterionDefinition[] {
  return [
    { id: 'fulfillment', label: 'Erfuellung', maxPoints: maxPoints[0] },
    { id: 'coherence', label: 'Kohaerenz', maxPoints: maxPoints[1] },
    { id: 'vocabulary', label: 'Wortschatz', maxPoints: maxPoints[2] },
    { id: 'structures', label: 'Strukturen', maxPoints: maxPoints[3] },
  ];
}

function extendedProductiveCriteria(
  maxPoints: [number, number, number, number, number]
): ExamCriterionDefinition[] {
  return [
    { id: 'content', label: 'Inhalt', maxPoints: maxPoints[0] },
    { id: 'coherence', label: 'Kohaerenz', maxPoints: maxPoints[1] },
    { id: 'vocabulary', label: 'Wortschatz', maxPoints: maxPoints[2] },
    { id: 'structures', label: 'Strukturen', maxPoints: maxPoints[3] },
    { id: 'register', label: 'Register', maxPoints: maxPoints[4] },
  ];
}

function singleCriterion(id: string, label: string, maxPoints: number): ExamCriterionDefinition[] {
  return [{ id, label, maxPoints }];
}

function speakingCriteria(maxPoints: [number, number, number, number]): ExamCriterionDefinition[] {
  return [
    { id: 'fulfillment', label: 'Erfuellung', maxPoints: maxPoints[0] },
    { id: 'interaction', label: 'Interaktion', maxPoints: maxPoints[1] },
    { id: 'vocabulary-register', label: 'Wortschatz, Register', maxPoints: maxPoints[2] },
    { id: 'structures', label: 'Strukturen', maxPoints: maxPoints[3] },
  ];
}

function spec(
  id: ExamModuleId,
  germanLabel: string,
  englishLabel: string,
  durationMinutes: number,
  instructions: string,
  templateParts: ExamModuleTemplatePart[]
): ExamModuleTemplateSpec {
  return {
    id,
    germanLabel,
    englishLabel,
    durationMinutes,
    parts: templateParts.length,
    instructions,
    templateParts,
  };
}
