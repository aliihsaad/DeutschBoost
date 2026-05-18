import type { AiProvider } from '../ai/aiProvider';
import type {
  ExamAnswerSet,
  ExamCriterionDefinition,
  ExamCriterionScore,
  ExamModule,
  ExamModuleId,
  ExamModuleTemplatePart,
  ExamObjectiveQuestion,
  ExamPartResult,
  ExamProductiveTask,
  ExamResult,
  ExamTemplateSource,
  GoetheExam,
} from './examTypes';
import { CEFRLevel } from '../../../types';

interface GenerateGoetheExamInput {
  level: CEFRLevel;
  aiProvider?: AiProvider;
  now?: () => string;
  idFactory?: () => string;
}

const LEVELS: CEFRLevel[] = [
  CEFRLevel.A1,
  CEFRLevel.A2,
  CEFRLevel.B1,
  CEFRLevel.B2,
  CEFRLevel.C1,
  CEFRLevel.C2,
];

const MODULE_ORDER: ExamModuleId[] = ['listening', 'reading', 'writing', 'speaking'];
const B1_OBJECTIVE_SCORE_POINTS = [
  0, 3, 7, 10, 13, 17, 20, 23, 27, 30, 33,
  37, 40, 43, 47, 50, 53, 57, 60, 63, 67,
  70, 73, 77, 80, 83, 87, 90, 93, 97, 100,
];

type ExamModuleTemplateSpec = Pick<
  ExamModule,
  'id' | 'germanLabel' | 'englishLabel' | 'durationMinutes' | 'parts' | 'instructions' | 'templateParts'
>;

interface GoetheExamTemplate {
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

const EXAM_TEMPLATES: Record<CEFRLevel, GoetheExamTemplate> = {
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

export async function generateGoetheExam(input: GenerateGoetheExamInput): Promise<GoetheExam> {
  const fallback = createFallbackGoetheExam(input);

  if (!input.aiProvider) {
    return fallback;
  }

  try {
    const generated = await input.aiProvider.generateJson<unknown>({
      feature: 'goethe-exam-simulator-generation',
      schemaName: 'DeutschBoostGoetheExam',
      options: { temperature: 0.4, maxTokens: 6000 },
      messages: [
        {
          role: 'system',
          content: [
            'You generate original German exam simulator content for a local learning app.',
            'Follow public Goethe-style exam structure exactly by level, modules, timing, and pass threshold.',
            'Do not copy official protected model test text verbatim. Create fresh content with the same task style.',
            'Return only JSON matching the requested structure.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: buildGenerationPrompt(input.level, fallback),
        },
      ],
    });

    return normalizeGeneratedExam(generated, fallback);
  } catch (error) {
    console.warn('Falling back to local exam content after AI exam generation failed:', error);
    return fallback;
  }
}

export function createFallbackGoetheExam(input: GenerateGoetheExamInput): GoetheExam {
  const level = LEVELS.includes(input.level) ? input.level : CEFRLevel.B1;
  const now = input.now ?? (() => new Date().toISOString());
  const idFactory = input.idFactory ?? (() => `exam-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const examTemplate = EXAM_TEMPLATES[level];
  const modules = examTemplate.modules.map(moduleSpec => createFallbackModule(level, moduleSpec));

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

export function scoreGoetheExam(exam: GoetheExam, answers: ExamAnswerSet): ExamResult {
  const wholeExamScoring = usesWholeExamScoring(exam.level);
  const moduleResults = exam.modules.map(module => {
    const partResults = scoreModuleParts(module, answers);
    const rawEarnedPoints = partResults.reduce((sum, result) => sum + result.earnedPoints, 0);
    const rawPossiblePoints = partResults.reduce((sum, result) => sum + result.possiblePoints, 0);
    const earnedPoints = wholeExamScoring
      ? convertWholeExamSectionPoints(exam.level, module, rawEarnedPoints)
      : convertRawScoreToCertificatePoints(module, rawEarnedPoints, rawPossiblePoints);
    const possiblePoints = wholeExamScoring ? 25 : 100;
    const lostPoints = possiblePoints - earnedPoints;
    const percentage = possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0;

    return {
      moduleId: module.id,
      germanLabel: module.germanLabel,
      englishLabel: module.englishLabel,
      rawEarnedPoints,
      rawPossiblePoints,
      earnedPoints,
      possiblePoints,
      lostPoints,
      percentage,
      passed: percentage >= exam.passThreshold,
      rating: describeGoetheRating(percentage),
      partResults,
    };
  });

  const totalEarnedPoints = moduleResults.reduce((sum, result) => sum + result.earnedPoints, 0);
  const totalPossiblePoints = moduleResults.reduce((sum, result) => sum + result.possiblePoints, 0);
  const percentage = totalPossiblePoints > 0 ? Math.round((totalEarnedPoints / totalPossiblePoints) * 100) : 0;
  const passed = wholeExamScoring
    ? wholeExamPassed(exam.level, moduleResults, percentage)
    : moduleResults.every(result => result.passed);

  return {
    totalEarnedPoints,
    totalPossiblePoints,
    percentage,
    passed,
    moduleResults,
    summary: summarizeResult(exam.level, moduleResults, percentage, passed),
  };
}

function createFallbackModule(
  level: CEFRLevel,
  moduleSpec: ExamModuleTemplateSpec
): ExamModule {
  return {
    ...moduleSpec,
    objectiveQuestions: createObjectiveQuestions(level, moduleSpec.id, moduleSpec.templateParts),
    productiveTasks: createProductiveTasks(level, moduleSpec.id, moduleSpec.templateParts),
  };
}

function createObjectiveQuestions(
  level: CEFRLevel,
  moduleId: ExamModuleId,
  templateParts: ExamModuleTemplatePart[]
): ExamObjectiveQuestion[] {
  if (moduleId === 'writing' || moduleId === 'speaking') {
    return [];
  }

  return templateParts.flatMap(partSpec => {
    const count = Math.max(1, partSpec.questionCount ?? partSpec.maxPoints ?? 1);
    const pointsPerQuestion = (partSpec.maxPoints ?? count) / count;

    return Array.from({ length: count }, (_, index) => {
      const itemNumber = index + 1;
      const content = createObjectiveFallbackContent(level, moduleId, partSpec, itemNumber);

      return {
        id: `${level}-${moduleId}-${partSpec.id}-${itemNumber}`,
        moduleId,
        partId: partSpec.id,
        passage: content.passage,
        prompt: content.prompt,
        options: content.options,
        correctOptionIndex: content.correctOptionIndex,
        points: pointsPerQuestion,
        explanation: 'One raw point is awarded only for the correct answer.',
      };
    });
  });
}

interface ObjectiveFallbackContent {
  passage: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
}

interface ListeningScenario {
  passage: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  trueStatement: string;
  falseStatement: string;
  matchingPrompt: string;
  matchingOptions: string[];
}

const LISTENING_SCENARIOS: ListeningScenario[] = [
  {
    passage: 'Guten Tag, hier ist die Sprachschule Berger. Der B1-Abendkurs beginnt heute ausnahmsweise um 18 Uhr in Raum 204. Bitte bringen Sie Ihr Kursbuch mit.',
    question: 'Wann beginnt der B1-Abendkurs heute?',
    options: ['Um 18 Uhr', 'Um 8 Uhr', 'Am Freitag'],
    correctOptionIndex: 0,
    trueStatement: 'Der Kurs beginnt heute um 18 Uhr.',
    falseStatement: 'Der Kurs findet heute im Rathaus statt.',
    matchingPrompt: 'Welche Situation passt zu dieser Nachricht?',
    matchingOptions: ['Eine Sprachschule informiert ueber den Kursbeginn', 'Ein Hotel bestaetigt eine Buchung', 'Eine Apotheke nennt Oeffnungszeiten'],
  },
  {
    passage: 'Achtung an Gleis 3. Der Regionalzug nach Leipzig faehrt heute nicht um 14:20 Uhr, sondern um 14:45 Uhr ab. Grund ist eine technische Kontrolle.',
    question: 'Wann faehrt der Regionalzug nach Leipzig ab?',
    options: ['Um 14:45 Uhr', 'Um 14:20 Uhr', 'Morgen frueh'],
    correctOptionIndex: 0,
    trueStatement: 'Der Zug faehrt spaeter als geplant ab.',
    falseStatement: 'Der Zug nach Leipzig faellt komplett aus.',
    matchingPrompt: 'Wo hoert man diese Durchsage?',
    matchingOptions: ['Am Bahnhof', 'Im Supermarkt', 'In der Arztpraxis'],
  },
  {
    passage: 'Guten Morgen, hier ist die Praxis Dr. Klein. Ihr Termin am Mittwoch muss leider auf Donnerstag um 9:30 Uhr verschoben werden. Bitte rufen Sie uns kurz zurueck.',
    question: 'Was soll die Person tun?',
    options: ['Die Praxis zurueckrufen', 'Am Mittwoch um 9:30 Uhr kommen', 'Einen neuen Arzt suchen'],
    correctOptionIndex: 0,
    trueStatement: 'Die Praxis bittet um einen Rueckruf.',
    falseStatement: 'Der Termin bleibt am Mittwoch.',
    matchingPrompt: 'Worum geht es in der Nachricht?',
    matchingOptions: ['Um einen Arzttermin', 'Um eine Wohnungsbesichtigung', 'Um eine Reisebuchung'],
  },
  {
    passage: 'Liebe Kundinnen und Kunden, heute gibt es frische Erdbeeren im Angebot. Ein Kilo kostet 3 Euro 90. Sie finden die Erdbeeren direkt am Eingang.',
    question: 'Was ist heute im Angebot?',
    options: ['Erdbeeren', 'Aepfel', 'Brot'],
    correctOptionIndex: 0,
    trueStatement: 'Die Erdbeeren stehen direkt am Eingang.',
    falseStatement: 'Ein Kilo Erdbeeren kostet 9 Euro 30.',
    matchingPrompt: 'Wo hoert man diese Information wahrscheinlich?',
    matchingOptions: ['Im Supermarkt', 'In der Bibliothek', 'Im Zug'],
  },
  {
    passage: 'Die Stadtbibliothek schliesst heute bereits um 16 Uhr. Ab morgen gelten wieder die normalen Oeffnungszeiten von 10 bis 19 Uhr.',
    question: 'Wann schliesst die Bibliothek heute?',
    options: ['Um 16 Uhr', 'Um 19 Uhr', 'Um 10 Uhr'],
    correctOptionIndex: 0,
    trueStatement: 'Heute schliesst die Bibliothek frueher.',
    falseStatement: 'Die Bibliothek bleibt heute bis 19 Uhr geoeffnet.',
    matchingPrompt: 'Welche Einrichtung informiert hier?',
    matchingOptions: ['Eine Bibliothek', 'Ein Fitnessstudio', 'Ein Kino'],
  },
  {
    passage: 'Hallo Frau Neumann, hier spricht Herr Yilmaz aus dem dritten Stock. Das Treffen der Hausgemeinschaft beginnt heute um 19 Uhr im Hof, nicht im Keller.',
    question: 'Wo findet das Treffen statt?',
    options: ['Im Hof', 'Im Keller', 'Im dritten Stock'],
    correctOptionIndex: 0,
    trueStatement: 'Die Hausgemeinschaft trifft sich im Hof.',
    falseStatement: 'Das Treffen beginnt um 17 Uhr.',
    matchingPrompt: 'Wer spricht wahrscheinlich?',
    matchingOptions: ['Ein Nachbar', 'Ein Fahrkartenkontrolleur', 'Eine Kursleiterin'],
  },
  {
    passage: 'Und nun das Wetter: Am Vormittag bleibt es trocken. Am Nachmittag gibt es starke Schauer und Wind. Nehmen Sie bitte einen Regenschirm mit.',
    question: 'Wie wird das Wetter am Nachmittag?',
    options: ['Es gibt Schauer und Wind', 'Es bleibt sonnig', 'Es schneit stark'],
    correctOptionIndex: 0,
    trueStatement: 'Am Nachmittag soll es regnen.',
    falseStatement: 'Am Vormittag gibt es starke Schauer.',
    matchingPrompt: 'Welche Art von Meldung ist das?',
    matchingOptions: ['Ein Wetterbericht', 'Eine Verkehrsmeldung', 'Eine private Einladung'],
  },
  {
    passage: 'Guten Tag, Frau Becker. Ihr Vorstellungsgespraech bei der Firma Nordlicht ist am Montag um 11 Uhr. Bitte melden Sie sich am Empfang im zweiten Stock.',
    question: 'Wo soll Frau Becker sich melden?',
    options: ['Am Empfang im zweiten Stock', 'In der Kantine', 'Am Montag zu Hause'],
    correctOptionIndex: 0,
    trueStatement: 'Das Vorstellungsgespraech ist am Montag.',
    falseStatement: 'Frau Becker soll in die Kantine kommen.',
    matchingPrompt: 'Worum geht es?',
    matchingOptions: ['Um ein Vorstellungsgespraech', 'Um eine Paketlieferung', 'Um einen Konzertbesuch'],
  },
  {
    passage: 'Liebe Eltern, der Elternabend der Klasse 6b beginnt morgen um 18:30 Uhr in der Aula. Die Klassenlehrerin stellt den neuen Stundenplan vor.',
    question: 'Was wird am Elternabend vorgestellt?',
    options: ['Der neue Stundenplan', 'Die Speisekarte', 'Ein Ferienhotel'],
    correctOptionIndex: 0,
    trueStatement: 'Der Elternabend findet in der Aula statt.',
    falseStatement: 'Der Elternabend beginnt morgen um 8:30 Uhr.',
    matchingPrompt: 'Wer soll diese Nachricht hoeren?',
    matchingOptions: ['Eltern einer Schulklasse', 'Fahrgaeste in einem Zug', 'Gaeste in einem Restaurant'],
  },
  {
    passage: 'Restaurant Lindenhof, guten Abend. Wir bestaetigen Ihre Reservierung fuer vier Personen am Samstag um 20 Uhr. Der Tisch ist auf den Namen Schmitt reserviert.',
    question: 'Fuer wie viele Personen ist der Tisch reserviert?',
    options: ['Fuer vier Personen', 'Fuer zwei Personen', 'Fuer zwanzig Personen'],
    correctOptionIndex: 0,
    trueStatement: 'Die Reservierung ist fuer Samstag um 20 Uhr.',
    falseStatement: 'Der Tisch ist auf den Namen Becker reserviert.',
    matchingPrompt: 'Welche Buchung wird bestaetigt?',
    matchingOptions: ['Eine Restaurantreservierung', 'Ein Sprachkurs', 'Ein Arzttermin'],
  },
  {
    passage: 'DHL Paketstation. Ihr Paket liegt ab heute in der Filiale in der Marktstrasse 12 bereit. Bitte bringen Sie Ihren Ausweis und die Abholnummer mit.',
    question: 'Was muss die Person mitbringen?',
    options: ['Ausweis und Abholnummer', 'Kursbuch und Stift', 'Reisepass und Flugticket'],
    correctOptionIndex: 0,
    trueStatement: 'Das Paket liegt in der Marktstrasse 12 bereit.',
    falseStatement: 'Das Paket wird morgen nach Hause geliefert.',
    matchingPrompt: 'Worum geht es in der Nachricht?',
    matchingOptions: ['Um ein Paket', 'Um einen Deutschkurs', 'Um eine Kinokarte'],
  },
  {
    passage: 'Fitness Aktiv informiert: Der Yogakurs um 18 Uhr faellt heute wegen Krankheit aus. Als Ersatz koennen Sie morgen um 17 Uhr am Pilateskurs teilnehmen.',
    question: 'Warum faellt der Yogakurs aus?',
    options: ['Wegen Krankheit', 'Wegen Renovierung', 'Wegen eines Feiertags'],
    correctOptionIndex: 0,
    trueStatement: 'Morgen gibt es einen Ersatzkurs.',
    falseStatement: 'Der Yogakurs beginnt heute um 17 Uhr.',
    matchingPrompt: 'Welche Freizeitaktivitaet betrifft die Nachricht?',
    matchingOptions: ['Sportkurs', 'Theaterprobe', 'Stadtfuehrung'],
  },
];

function createObjectiveFallbackContent(
  level: CEFRLevel,
  moduleId: ExamModuleId,
  partSpec: ExamModuleTemplatePart,
  itemNumber: number
): ObjectiveFallbackContent {
  if (moduleId === 'listening') {
    return createListeningFallbackContent(level, partSpec, itemNumber);
  }

  if (moduleId === 'reading' && partSpec.id === 'teil-1' && itemNumber === 1) {
    return {
      passage: 'Text: Im Stadtteilzentrum beginnt am Dienstag ein Deutschkurs. Der Kurs findet abends in Raum 204 statt.',
      prompt: 'Wo findet der Kurs statt?',
      options: ['Im Raum 204', 'Im Rathaus', 'Online'],
      correctOptionIndex: 0,
    };
  }

  if (moduleId === 'reading' && partSpec.id === 'teil-1' && itemNumber === 2) {
    return {
      passage: 'Text: Lea schreibt Max, dass sie am Samstag einkaufen gehen moechte und ihn um 10 Uhr trifft.',
      prompt: 'Wann trifft Lea Max?',
      options: ['Am Freitag', 'Um 10 Uhr', 'Am Abend'],
      correctOptionIndex: 1,
    };
  }

  const passage = createObjectivePassage(level, moduleId, partSpec, itemNumber);
  const prompt = createObjectivePrompt(moduleId, partSpec, itemNumber);
  const options = createObjectiveOptions(moduleId, itemNumber);

  return {
    passage,
    prompt,
    options,
    correctOptionIndex: itemNumber % options.length,
  };
}

function createListeningFallbackContent(
  _level: CEFRLevel,
  partSpec: ExamModuleTemplatePart,
  itemNumber: number
): ObjectiveFallbackContent {
  const scenario = LISTENING_SCENARIOS[
    Math.abs(hashString(`${partSpec.id}-${itemNumber}`)) % LISTENING_SCENARIOS.length
  ]!;

  if (partSpec.answerFormat.includes('right / wrong')) {
    const usesFalseStatement = itemNumber % 2 === 0;
    return {
      passage: scenario.passage,
      prompt: usesFalseStatement ? scenario.falseStatement : scenario.trueStatement,
      options: ['Richtig', 'Falsch'],
      correctOptionIndex: usesFalseStatement ? 1 : 0,
    };
  }

  if (partSpec.answerFormat.includes('matching')) {
    return {
      passage: scenario.passage,
      prompt: scenario.matchingPrompt,
      options: scenario.matchingOptions,
      correctOptionIndex: 0,
    };
  }

  return {
    passage: scenario.passage,
    prompt: scenario.question,
    options: scenario.options,
    correctOptionIndex: scenario.correctOptionIndex,
  };
}

function hashString(value: string): number {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function createProductiveTasks(
  level: CEFRLevel,
  moduleId: ExamModuleId,
  templateParts: ExamModuleTemplatePart[]
): ExamProductiveTask[] {
  if (moduleId === 'writing') {
    return templateParts.map((partSpec, index) => ({
      id: `${level}-writing-${index + 1}`,
      moduleId: 'writing',
      partId: partSpec.id,
      prompt: createWritingPrompt(level, partSpec, index),
      minWords: getWritingWordGuide(level, partSpec, index),
      points: partSpec.maxPoints ?? 20,
      rubric: (partSpec.criteria ?? productiveCriteria([5, 5, 5, 5])).map(criterion => criterion.label),
    }));
  }

  if (moduleId === 'speaking') {
    return templateParts
      .filter(partSpec => partSpec.id !== 'pronunciation')
      .map((partSpec, index) => ({
        id: `${level}-speaking-${index + 1}`,
        moduleId: 'speaking',
        partId: partSpec.id,
        prompt: createSpeakingPrompt(level, partSpec, index),
        minWords: level === CEFRLevel.A1 ? 25 : 60,
        points: partSpec.maxPoints ?? 20,
        rubric: (partSpec.criteria ?? speakingCriteria([5, 5, 5, 5])).map(criterion => criterion.label),
      }));
  }

  return [];
}

function createObjectivePassage(
  level: CEFRLevel,
  moduleId: ExamModuleId,
  partSpec: ExamModuleTemplatePart,
  itemNumber: number
): string {
  if (moduleId === 'listening') {
    return createListeningFallbackContent(level, partSpec, itemNumber).passage;
  }

  if (partSpec.id === 'teil-1' && itemNumber === 1) {
    return 'Text: Im Stadtteilzentrum beginnt am Dienstag ein Deutschkurs. Der Kurs findet abends in Raum 204 statt.';
  }
  if (partSpec.id === 'teil-1' && itemNumber === 2) {
    return 'Text: Lea schreibt Max, dass sie am Samstag einkaufen gehen moechte und ihn um 10 Uhr trifft.';
  }
  return `Text ${partSpec.title}.${itemNumber}: Ein originaler ${level}-Lesetext im Stil "${partSpec.taskFamily}". Die Loesung ist im Text direkt oder indirekt enthalten.`;
}

function createObjectivePrompt(
  moduleId: ExamModuleId,
  partSpec: ExamModuleTemplatePart,
  itemNumber: number
): string {
  if (partSpec.answerFormat.includes('right / wrong')) {
    return moduleId === 'listening'
      ? `Welche Aussage zu Aufgabe ${itemNumber} ist richtig?`
      : `Aussage ${itemNumber}: Die Aussage passt zum Text.`;
  }

  if (partSpec.answerFormat.includes('matching')) {
    return `Welche Option passt zu Aufgabe ${itemNumber}?`;
  }

  return `Waehlen Sie die richtige Antwort zu Aufgabe ${itemNumber}.`;
}

function createObjectiveOptions(moduleId: ExamModuleId, itemNumber: number): string[] {
  if (itemNumber % 2 === 0) {
    return ['Richtig', 'Falsch'];
  }

  return moduleId === 'listening'
    ? ['Richtig', 'Falsch']
    : ['Option a aus dem Text', 'Option b aus dem Text', 'Option c aus dem Text'];
}

function createWritingPrompt(level: CEFRLevel, partSpec: ExamModuleTemplatePart, index: number): string {
  if (level === CEFRLevel.B1 && partSpec.id === 'teil-1') {
    return 'Schreiben Sie eine E-Mail an eine Freundin. Beschreiben Sie eine Feier, begruenden Sie, welches Geschenk besonders gut war, und machen Sie einen Vorschlag fuer ein Treffen.';
  }
  if (level === CEFRLevel.B1 && partSpec.id === 'teil-2') {
    return 'Schreiben Sie einen Diskussionsbeitrag zum Thema persoenliche Kontakte und Internet. Aeussern Sie Ihre Meinung, nennen Sie Gruende und geben Sie Beispiele.';
  }
  if (level === CEFRLevel.B1 && partSpec.id === 'teil-3') {
    return 'Schreiben Sie eine formelle E-Mail an Ihre Kursleiterin. Entschuldigen Sie sich, erklaeren Sie den Grund und bitten Sie um einen neuen Termin.';
  }

  return index === 0
    ? 'Schreiben Sie einen zusammenhaengenden Text zu allen Inhaltspunkten der Aufgabe.'
    : 'Schreiben Sie eine passende Nachricht mit angemessenem Register.';
}

function createSpeakingPrompt(level: CEFRLevel, partSpec: ExamModuleTemplatePart, index: number): string {
  if (level === CEFRLevel.B1 && partSpec.id === 'teil-1') {
    return 'Planen Sie gemeinsam mit Ihrem Partner/Ihrer Partnerin einen Ausflug fuer Ihren Deutschkurs. Sprechen Sie ueber Ziel, Zeit, Transport und Aufgaben.';
  }
  if (level === CEFRLevel.B1 && partSpec.id === 'teil-2') {
    return 'Praesentieren Sie ein Thema: Deutschlernen im Alltag. Berichten Sie von Ihrer Situation, nennen Sie Vor- und Nachteile und sagen Sie Ihre Meinung.';
  }
  if (level === CEFRLevel.B1 && partSpec.id === 'teil-3') {
    return 'Reagieren Sie auf Rueckfragen zu Ihrer Praesentation und stellen Sie selbst eine passende Frage.';
  }

  return index === 0
    ? 'Sprechen Sie frei zur Aufgabe und geben Sie Beispiele.'
    : 'Reagieren Sie auf Rueckfragen und fuehren Sie das Gespraech weiter.';
}

function getWritingWordGuide(level: CEFRLevel, partSpec: ExamModuleTemplatePart, index: number): number {
  if (level === CEFRLevel.B1 && (partSpec.id === 'teil-1' || partSpec.id === 'teil-2')) {
    return 80;
  }
  if (level === CEFRLevel.B1 && partSpec.id === 'teil-3') {
    return 40;
  }
  if (level === CEFRLevel.A1) {
    return 35;
  }
  return index === 0 ? 80 : 60;
}

function scoreModuleParts(module: ExamModule, answers: ExamAnswerSet): ExamPartResult[] {
  const templateResults = module.templateParts.map(partSpec => {
    const questions = module.objectiveQuestions.filter(question => question.partId === partSpec.id);
    const tasks = module.productiveTasks.filter(task => task.partId === partSpec.id);

    if (questions.length > 0) {
      const earnedPoints = questions.reduce(
        (sum, question) => sum + (answers.objective[question.id] === question.correctOptionIndex ? question.points : 0),
        0
      );
      const possiblePoints = partSpec.maxPoints ?? questions.reduce((sum, question) => sum + question.points, 0);

      return {
        partId: partSpec.id,
        title: partSpec.title,
        earnedPoints,
        possiblePoints,
        lostPoints: Math.max(0, possiblePoints - earnedPoints),
        percentage: possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0,
        scoringNote: partSpec.scoringNote ?? '1 raw point per correct answer; wrong answers receive 0 points.',
      };
    }

    if (tasks.length > 0 || partSpec.criteria?.length) {
      const scoringTasks = tasks.length > 0 ? tasks : [{
        id: `${module.id}-${partSpec.id}`,
        moduleId: module.id as Extract<ExamModuleId, 'writing' | 'speaking'>,
        partId: partSpec.id,
        prompt: partSpec.promptGuidance,
        points: partSpec.maxPoints ?? 0,
        rubric: partSpec.criteria?.map(criterion => criterion.label) ?? [],
      }];
      const productiveAnswer = partSpec.id === 'pronunciation'
        ? module.productiveTasks.map(task => answers.productive[task.id] ?? '').join('\n\n')
        : scoringTasks.map(task => answers.productive[task.id] ?? '').join('\n\n');
      const criteria = scoreProductiveCriteria(
        productiveAnswer,
        partSpec.criteria,
        partSpec.maxPoints ?? scoringTasks.reduce((sum, task) => sum + task.points, 0),
        scoringTasks.reduce((minWords, task) => Math.max(minWords, task.minWords ?? 60), 60)
      );
      const earnedPoints = criteria.reduce((sum, criterion) => sum + criterion.earnedPoints, 0);
      const possiblePoints = criteria.reduce((sum, criterion) => sum + criterion.possiblePoints, 0);

      return {
        partId: partSpec.id,
        title: partSpec.title,
        earnedPoints,
        possiblePoints,
        lostPoints: Math.max(0, possiblePoints - earnedPoints),
        percentage: possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0,
        scoringNote: partSpec.scoringNote ?? 'Simulator rubric score; official exams use trained examiners and designated point values.',
        criteria,
      };
    }

    return null;
  });

  const results = templateResults.filter((result): result is ExamPartResult => result !== null);

  if (results.length > 0) {
    return results;
  }

  return scoreLegacyModuleParts(module, answers);
}

function convertRawScoreToCertificatePoints(
  module: ExamModule,
  rawEarnedPoints: number,
  rawPossiblePoints: number
): number {
  if (rawPossiblePoints <= 0) {
    return 0;
  }

  if (
    (module.id === 'reading' || module.id === 'listening') &&
    rawPossiblePoints === 30 &&
    rawEarnedPoints >= 0 &&
    rawEarnedPoints <= 30
  ) {
    return B1_OBJECTIVE_SCORE_POINTS[Math.round(rawEarnedPoints)] ?? 0;
  }

  return Math.round((rawEarnedPoints / rawPossiblePoints) * 100);
}

function usesWholeExamScoring(level: CEFRLevel): boolean {
  return level === CEFRLevel.A1 || level === CEFRLevel.A2;
}

function convertWholeExamSectionPoints(
  level: CEFRLevel,
  module: ExamModule,
  rawEarnedPoints: number
): number {
  if (level === CEFRLevel.A1) {
    return Math.min(25, Math.round(rawEarnedPoints * 1.66));
  }

  if (module.id === 'speaking') {
    return Math.min(25, Math.round(rawEarnedPoints));
  }

  return Math.min(25, Math.round(rawEarnedPoints * 1.25));
}

function wholeExamPassed(
  level: CEFRLevel,
  moduleResults: ExamModuleResult[],
  percentage: number
): boolean {
  if (percentage < 60) {
    return false;
  }

  if (level === CEFRLevel.A2) {
    const writtenPoints = modulePoints(moduleResults, 'listening')
      + modulePoints(moduleResults, 'reading')
      + modulePoints(moduleResults, 'writing');
    const oralPoints = modulePoints(moduleResults, 'speaking');

    return writtenPoints >= 45 && oralPoints >= 15;
  }

  return moduleResults.every(result => result.rawEarnedPoints > 0);
}

function summarizeResult(
  level: CEFRLevel,
  moduleResults: ExamModuleResult[],
  percentage: number,
  passed: boolean
): string {
  if (passed) {
    return `Passed the simulated ${level} exam.`;
  }

  if (level === CEFRLevel.A2 && percentage >= 60) {
    const writtenPoints = modulePoints(moduleResults, 'listening')
      + modulePoints(moduleResults, 'reading')
      + modulePoints(moduleResults, 'writing');
    const oralPoints = modulePoints(moduleResults, 'speaking');

    if (oralPoints < 15) {
      return 'Needs at least 15 points in the oral section before the simulated A2 pass threshold is met.';
    }
    if (writtenPoints < 45) {
      return 'Needs at least 45 points across the written sections before the simulated A2 pass threshold is met.';
    }
  }

  return `Needs more work before the simulated ${level} pass threshold.`;
}

function modulePoints(moduleResults: ExamModuleResult[], moduleId: ExamModuleId): number {
  return moduleResults.find(result => result.moduleId === moduleId)?.earnedPoints ?? 0;
}

function scoreLegacyModuleParts(module: ExamModule, answers: ExamAnswerSet): ExamPartResult[] {
  const earnedObjective = module.objectiveQuestions.reduce(
    (sum, question) => sum + (answers.objective[question.id] === question.correctOptionIndex ? question.points : 0),
    0
  );
  const possibleObjective = module.objectiveQuestions.reduce((sum, question) => sum + question.points, 0);
  const earnedProductive = module.productiveTasks.reduce(
    (sum, task) => sum + scoreProductiveAnswer(answers.productive[task.id] ?? '', task),
    0
  );
  const possibleProductive = module.productiveTasks.reduce((sum, task) => sum + task.points, 0);
  const possiblePoints = possibleObjective + possibleProductive;
  const earnedPoints = earnedObjective + earnedProductive;

  return [{
    partId: module.id,
    title: module.germanLabel,
    earnedPoints,
    possiblePoints,
    lostPoints: Math.max(0, possiblePoints - earnedPoints),
    percentage: possiblePoints > 0 ? Math.round((earnedPoints / possiblePoints) * 100) : 0,
    scoringNote: 'Simulator score.',
  }];
}

function scoreProductiveCriteria(
  answer: string,
  criteria: ExamCriterionDefinition[] | undefined,
  fallbackPossiblePoints: number,
  minWords = 60
): ExamCriterionScore[] {
  const definitions = criteria && criteria.length > 0
    ? criteria
    : [{ id: 'response', label: 'Response', maxPoints: fallbackPossiblePoints }];
  const band = scoreProductiveBand(answer, minWords);

  return definitions.map(criterion => {
    const earnedPoints = pointsForBand(criterion.maxPoints, band);

    return {
      criterionId: criterion.id,
      label: criterion.label,
      band,
      earnedPoints,
      possiblePoints: criterion.maxPoints,
      lostPoints: Math.max(0, criterion.maxPoints - earnedPoints),
    };
  });
}

function scoreProductiveAnswer(answer: string, task: ExamProductiveTask): number {
  return scoreProductiveAnswerByMax(answer, task.points, task.minWords);
}

function scoreProductiveAnswerByMax(answer: string, maxPoints: number, minWords = 60): number {
  return pointsForBand(maxPoints, scoreProductiveBand(answer, minWords));
}

function scoreProductiveBand(answer: string, minWords = 60): ExamCriterionScore['band'] {
  const normalized = answer.trim();
  if (!normalized) {
    return 'E';
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const enoughLength = Math.min(1, words.length / minWords);
  const germanSignal = /\b(ich|wir|sie|der|die|das|und|weil|dass|nicht|mit|fuer|moechte|kann|habe|bin)\b/i.test(normalized)
    ? 1
    : 0.35;
  const sentenceShape = /[.!?]/.test(normalized) ? 1 : 0.5;
  const scoreRatio = (enoughLength * 0.5) + (germanSignal * 0.3) + (sentenceShape * 0.2);

  if (scoreRatio >= 0.88) {
    return 'A';
  }
  if (scoreRatio >= 0.68) {
    return 'B';
  }
  if (scoreRatio >= 0.45) {
    return 'C';
  }
  if (scoreRatio >= 0.2) {
    return 'D';
  }
  return 'E';
}

function pointsForBand(maxPoints: number, band: ExamCriterionScore['band']): number {
  const ratioByBand: Record<ExamCriterionScore['band'], number> = {
    A: 1,
    B: 0.75,
    C: 0.5,
    D: 0.25,
    E: 0,
  };

  return maxPoints * ratioByBand[band];
}

function describeGoetheRating(points: number): string {
  if (points >= 90) {
    return 'very good';
  }
  if (points >= 80) {
    return 'good';
  }
  if (points >= 70) {
    return 'satisfactory';
  }
  if (points >= 60) {
    return 'pass';
  }
  return 'fail';
}

function normalizeGeneratedExam(value: unknown, fallback: GoetheExam): GoetheExam {
  const root = asRecord(value);
  const modules = Array.isArray(root.modules)
    ? root.modules.map((module, index) => normalizeModule(module, fallback.modules[index])).filter(isModule)
    : fallback.modules;
  const normalizedModules = MODULE_ORDER
    .map(moduleId => modules.find(module => module.id === moduleId) ?? fallback.modules.find(module => module.id === moduleId))
    .filter(isModule);

  if (normalizedModules.length !== fallback.modules.length) {
    return fallback;
  }

  return {
    ...fallback,
    title: normalizeString(root.title) ?? fallback.title,
    templateName: fallback.templateName,
    officialSources: fallback.officialSources,
    sourceNotes: normalizeStringArray(root.sourceNotes, fallback.sourceNotes),
    modules: normalizedModules,
    totalMinutes: normalizedModules.reduce((sum, module) => sum + module.durationMinutes, 0),
  };
}

function normalizeModule(value: unknown, fallback?: ExamModule): ExamModule | null {
  if (!fallback) {
    return null;
  }

  const root = asRecord(value);
  const id = normalizeModuleId(root.id) ?? fallback.id;
  const objectiveQuestions = Array.isArray(root.objectiveQuestions)
    ? fallback.objectiveQuestions
        .map((fallbackQuestion, index) => normalizeObjectiveQuestion(root.objectiveQuestions[index], id, fallbackQuestion))
        .filter(isObjectiveQuestion)
    : fallback.objectiveQuestions;
  const productiveTasks = Array.isArray(root.productiveTasks)
    ? root.productiveTasks.map((task, index) => normalizeProductiveTask(task, fallback.productiveTasks[index])).filter(isProductiveTask)
    : fallback.productiveTasks;

  return {
    ...fallback,
    id,
    germanLabel: normalizeString(root.germanLabel) ?? fallback.germanLabel,
    englishLabel: normalizeString(root.englishLabel) ?? fallback.englishLabel,
    instructions: normalizeString(root.instructions) ?? fallback.instructions,
    templateParts: fallback.templateParts,
    objectiveQuestions: objectiveQuestions.length > 0 ? objectiveQuestions : fallback.objectiveQuestions,
    productiveTasks: productiveTasks.length > 0 ? productiveTasks : fallback.productiveTasks,
  };
}

function normalizeObjectiveQuestion(
  value: unknown,
  moduleId: ExamModuleId,
  fallback?: ExamObjectiveQuestion
): ExamObjectiveQuestion | null {
  const root = asRecord(value);
  const prompt = normalizeString(root.prompt) ?? fallback?.prompt;
  const options = Array.isArray(root.options)
    ? root.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0).slice(0, 4)
    : fallback?.options;

  if (!prompt || !options || options.length < 2) {
    return fallback ?? null;
  }

  const correctOptionIndex = typeof root.correctOptionIndex === 'number'
    ? Math.max(0, Math.min(options.length - 1, Math.round(root.correctOptionIndex)))
    : fallback?.correctOptionIndex ?? 0;

  const normalized = {
    id: normalizeString(root.id) ?? fallback?.id ?? `${moduleId}-${Math.random().toString(36).slice(2, 8)}`,
    moduleId,
    partId: normalizeString(root.partId) ?? fallback?.partId,
    passage: normalizeString(root.passage) ?? fallback?.passage,
    prompt,
    options,
    correctOptionIndex,
    points: typeof root.points === 'number' && root.points > 0 ? root.points : fallback?.points ?? 10,
    explanation: normalizeString(root.explanation) ?? fallback?.explanation,
  };

  if (moduleId === 'listening' && !isValidListeningQuestion(normalized)) {
    return fallback ?? null;
  }

  return normalized;
}

function isValidListeningQuestion(question: ExamObjectiveQuestion): boolean {
  const passage = question.passage?.trim() ?? '';

  if (!passage) {
    return false;
  }

  const visibleText = `${question.prompt} ${question.options.join(' ')}`;
  const allText = `${passage} ${visibleText}`;

  if (/Audio script|Hoertext|Hörtext|Option [abc]|kurze .*Situation|wichtige Information/i.test(allText)) {
    return false;
  }

  if (/Die gehoerte Information passt zur Situation/i.test(question.prompt)) {
    return false;
  }

  return true;
}

function normalizeProductiveTask(value: unknown, fallback?: ExamProductiveTask): ExamProductiveTask | null {
  const root = asRecord(value);
  const moduleId = normalizeModuleId(root.moduleId);
  const prompt = normalizeString(root.prompt) ?? fallback?.prompt;

  if ((moduleId !== 'writing' && moduleId !== 'speaking' && !fallback) || !prompt) {
    return fallback ?? null;
  }

  return {
    id: normalizeString(root.id) ?? fallback?.id ?? `productive-${Math.random().toString(36).slice(2, 8)}`,
    moduleId: moduleId === 'speaking' ? 'speaking' : 'writing',
    partId: normalizeString(root.partId) ?? fallback?.partId,
    prompt,
    context: normalizeString(root.context) ?? fallback?.context,
    minWords: typeof root.minWords === 'number' ? root.minWords : fallback?.minWords,
    points: typeof root.points === 'number' && root.points > 0 ? root.points : fallback?.points ?? 20,
    rubric: normalizeStringArray(root.rubric, fallback?.rubric ?? ['Task completion', 'Clarity', 'German accuracy']),
  };
}

function buildGenerationPrompt(level: CEFRLevel, fallback: GoetheExam): string {
  return JSON.stringify({
    task: 'Generate a complete original Goethe-style simulator exam.',
    level,
    constraints: {
      templateName: fallback.templateName,
      officialSourceUrls: fallback.officialSources.map(source => source.url),
      exactModules: fallback.modules.map(module => ({
        id: module.id,
        germanLabel: module.germanLabel,
        englishLabel: module.englishLabel,
        durationMinutes: module.durationMinutes,
        parts: module.parts,
      })),
      moduleBlueprints: fallback.modules.map(module => ({
        id: module.id,
        durationMinutes: module.durationMinutes,
        parts: module.templateParts.map(part => ({
          title: part.title,
          taskFamily: part.taskFamily,
          answerFormat: part.answerFormat,
          questionCount: part.questionCount,
          maxPoints: part.maxPoints,
          criteria: part.criteria,
          promptGuidance: part.promptGuidance,
        })),
      })),
      passThreshold: fallback.passThreshold,
      objectiveQuestionsPerPart: 'Use each moduleBlueprint part questionCount exactly when generating objective items.',
      productiveTasksPerPart: 'Generate one productive task for each Writing and Speaking blueprint part, except global pronunciation criteria.',
      listeningAudio: 'For listening objectiveQuestions, passage is the hidden German audio script that Deepgram TTS reads verbatim. The learner must not see passage. The visible prompt and options must be concrete answer items about that script.',
      noListeningPlaceholders: 'Never use placeholder text such as Audio script, Hoertext, Option a aus dem Hoertext, wichtige Information, or generic Aussage passt zur Situation prompts.',
      outputLanguage: 'German prompts with concise English labels allowed',
      preserveTemplateShape: 'Do not change module order, timing, part count, answer formats, or pass threshold.',
      scoring: 'Each module reports 100 certificate points. Reading/listening objective raw points are converted to 100. Writing/speaking use the criteria and max point values in the moduleBlueprints.',
      noVerbatimOfficialPaperCopying: true,
    },
    requiredJsonShape: {
      title: 'string',
      sourceNotes: ['string'],
      modules: [
        {
          id: 'listening | reading | writing | speaking',
          germanLabel: 'string',
          englishLabel: 'string',
          instructions: 'string',
          objectiveQuestions: [
            {
              id: 'string',
              partId: 'string',
              passage: 'string',
              prompt: 'string',
              options: ['string', 'string', 'string'],
              correctOptionIndex: 0,
              points: 10,
              explanation: 'string',
            },
          ],
          productiveTasks: [
            {
              id: 'string',
              partId: 'string',
              moduleId: 'writing | speaking',
              prompt: 'string',
              minWords: 80,
              points: 20,
              rubric: ['string'],
            },
          ],
        },
      ],
    },
  });
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

function extendedProductiveCriteria(maxPoints: [number, number, number, number, number]): ExamCriterionDefinition[] {
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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  const normalized = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeModuleId(value: unknown): ExamModuleId | undefined {
  return MODULE_ORDER.find(moduleId => moduleId === value);
}

function isModule(value: ExamModule | null | undefined): value is ExamModule {
  return Boolean(value);
}

function isObjectiveQuestion(value: ExamObjectiveQuestion | null): value is ExamObjectiveQuestion {
  return value !== null;
}

function isProductiveTask(value: ExamProductiveTask | null): value is ExamProductiveTask {
  return value !== null;
}
