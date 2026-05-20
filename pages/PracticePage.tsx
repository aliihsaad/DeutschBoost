import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CEFRLevel, SkillType } from '../types';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';
import {
  Badge,
  Button,
  Card,
  Field,
  OptionCard,
  PageHeader,
  SegmentedControl,
} from '../components/ui';

const TOPIC_OPTIONS = [
  'Daily routines',
  'Travel',
  'Work',
  'Shopping',
  'Food and restaurants',
  'Appointments',
  'Housing',
  'Health',
  'Exam practice',
  'General conversation',
];

const SKILLS: Array<{ title: SkillType; icon: string; description: string }> = [
  { title: 'Grammar', icon: '📝', description: 'Practice German grammar rules and sentence structures.' },
  { title: 'Vocabulary', icon: '📚', description: 'Build your German vocabulary with themed word sets.' },
  { title: 'Listening', icon: '👂', description: 'Improve comprehension with audio exercises.' },
  { title: 'Writing', icon: '✍️', description: 'Practice writing essays and formal/informal texts.' },
  { title: 'Speaking', icon: '🗣️', description: 'Have conversations with AI and get pronunciation feedback.' },
  { title: 'Reading', icon: '📖', description: 'Read German texts and answer comprehension questions.' },
];

const LEVELS: CEFRLevel[] = [
  CEFRLevel.A1,
  CEFRLevel.A2,
  CEFRLevel.B1,
  CEFRLevel.B2,
  CEFRLevel.C1,
  CEFRLevel.C2,
];

function createLocalSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-practice-${Date.now()}`;
}

export const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  const [showSkillSelector, setShowSkillSelector] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillType | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel | null>(null);
  const [profileLevel, setProfileLevel] = useState<CEFRLevel>(CEFRLevel.A1);
  const [selectedTopic, setSelectedTopic] = useState(TOPIC_OPTIONS[0]);

  useEffect(() => {
    let cancelled = false;

    async function loadLocalProfile() {
      try {
        const profile = await browserProfileRepository.loadProfile();
        if (!cancelled) {
          setProfileLevel(profile.currentLevel);
        }
      } catch (error) {
        console.error('Error loading local practice profile:', error);
      }
    }

    loadLocalProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSkillClick = (skill: SkillType) => {
    setSelectedSkill(skill);
    setSelectedLevel(profileLevel);
    setSelectedTopic(TOPIC_OPTIONS[0]);
    setShowSkillSelector(true);
  };

  const handleStartPractice = (skill: SkillType, level: CEFRLevel, topic: string) => {
    const sessionId = createLocalSessionId();

    if (skill === 'Speaking') {
      navigate(
        `/speaking-activity?practiceMode=true&sessionId=${sessionId}&topic=${encodeURIComponent(topic)}&level=${level}`,
      );
    } else {
      navigate(
        `/activity?practiceMode=true&sessionId=${sessionId}&type=${skill.toLowerCase()}&topic=${encodeURIComponent(topic)}&level=${level}`,
      );
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8" aria-label="Practice hub">
      <PageHeader
        title="🎯 Practice Hub"
        subtitle="Goethe-Zertifikat focused practice with AI-powered feedback."
      />

      <Card title="⚡ Quick Practice">
        <p className="mb-4 text-[13px] text-text-muted">Choose a skill to practice right now.</p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map(skill => (
            <OptionCard
              key={skill.title}
              label={`${skill.icon}  ${skill.title}`}
              description={skill.description}
              onSelect={() => handleSkillClick(skill.title)}
            />
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge tone="brand">Exam preparation</Badge>
            <h2 className="mt-2 text-[20px] font-bold text-text">Goethe Exam Simulator</h2>
            <p className="mt-1 text-[14px] text-text-muted">
              Open a timed Goethe-style workspace with level-specific reading, listening, writing, and speaking
              modules.
            </p>
          </div>
          <Button onClick={() => navigate('/exam')}>Open Exam Simulator</Button>
        </div>
      </Card>

      {showSkillSelector && selectedSkill && selectedLevel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedSkill} practice options`}
        >
          <Card className="w-full max-w-md" title={`${selectedSkill} Practice`}>
            <Field label="Level" htmlFor="practice-level">
              <SegmentedControl
                ariaLabel="Level"
                value={selectedLevel}
                options={LEVELS.map(level => ({ value: level, label: level }))}
                onChange={value => setSelectedLevel(value as CEFRLevel)}
              />
            </Field>
            <div className="mt-4">
              <Field label="Topic" htmlFor="practice-topic">
                <select
                  id="practice-topic"
                  value={selectedTopic}
                  onChange={event => setSelectedTopic(event.target.value)}
                  className="w-full rounded-control border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-brand focus:outline-none"
                >
                  {TOPIC_OPTIONS.map(topic => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-6 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowSkillSelector(false);
                  setSelectedSkill(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  handleStartPractice(selectedSkill, selectedLevel, selectedTopic);
                  setShowSkillSelector(false);
                }}
              >
                Start Practice
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
};
