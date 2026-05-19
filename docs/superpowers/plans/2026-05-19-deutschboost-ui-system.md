# DeutschBoost UI System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two competing styling systems with one token-driven shared component kit and convert every page onto it, so the whole app is visually cohesive and learner-friendly with no behavior change.

**Architecture:** Tailwind v4 `@theme` becomes the single token source. A small presentational kit in `components/ui/` composes every page. Each page conversion is presentation-only and guarded by the existing comprehensive page test (no tests assert CSS classes; `experienceDesignTokens` has no app consumers). `.db-*` rules are deleted from `src/index.css` per page until none remain.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/postcss`), Vitest + Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-05-19-deutschboost-ui-system-design.md`

---

## Critical Facts (verified)

- `src/index.css` is 2324 lines; Tailwind v4 via `@import "tailwindcss";`. Tokens live as `:root { --db-* }` plus `src/ui/designTokens.ts` (a separate constant) plus hardcoded hex in pages.
- **No test asserts a `.db-*` class.** All page/shell tests assert ARIA roles, labels, placeholders, and text. Therefore presentation-only conversions pass iff roles/labels/text are preserved.
- `experienceDesignTokens` is consumed only by `tests/ui/designTokens.test.ts`. Changing tokens affects only that test.
- Guard tests per surface: `tests/components/ExperienceAppShell.test.tsx` (17), `tests/pages/LocalDashboardPage.test.tsx` (14), `ActivityPage.completion.test.tsx` (9), `ActivityPage.voice.test.tsx` (5), `SpeakingActivityPage.test.tsx` (15), `ExamSimulatorPage.test.tsx` (52), `EnhancedPlacementTestPage.test.tsx` (12), `LocalSettingsPage.test.tsx` (48), `ProfilePage.test.tsx` (15), `LearningPlanPage.test.tsx` (7), `PracticePage.test.tsx` (3). Baseline suite = 301 tests, all green.

## Conversion Contract (applies to every page task)

A page conversion task is **done** only when ALL hold:

1. The page renders only kit components + Tailwind token utilities; it adds no `.db-*` class.
2. Every ARIA role, `aria-label`, placeholder, heading text, and visible label asserted by that page's test file is preserved verbatim.
3. The `.db-*` CSS rules used **only** by that page are deleted from `src/index.css`.
4. `npm run test:run` is fully green (301 baseline; only intentional token/test edits listed in tasks change counts).
5. `npm run build` succeeds.
6. One commit, message `feat(ui): convert <Page> to shared kit`, no `Co-Authored-By` trailer.

Page tasks are recipe + contract + verification (not literal full-page JSX): the page files are 200–900 lines and the existing test is the exact regression oracle. The executor rewrites the page's JSX to compose the kit while keeping the contract; the test proves equivalence.

## File Structure

```
src/index.css                  # @theme tokens + base only; .db-* deleted progressively
src/ui/designTokens.ts         # typed mirror of the @theme tokens (kept for token test)
components/ui/
  tokens.ts                    # TS token constants (skill colors, etc.) re-used by components
  cn.ts                        # className join helper
  PageHeader.tsx
  Card.tsx
  Button.tsx
  Field.tsx
  Stat.tsx
  Badge.tsx
  ProgressBar.tsx
  Ring.tsx
  EmptyState.tsx
  Notice.tsx
  Toast.tsx
  SegmentedControl.tsx
  OptionCard.tsx
  index.ts                     # barrel export
components/ExperienceAppShell.tsx   # refactored to kit + tokens
pages/*.tsx                    # each composed from components/ui
tests/components/ui/*.test.tsx # kit unit tests
```

---

## Task 1: Token theme + Tailwind wiring

**Files:**
- Modify: `src/index.css` (replace `:root` token block; add `@theme`)
- Modify: `src/ui/designTokens.ts`
- Test: `tests/ui/designTokens.test.ts` (update to new values)

- [ ] **Step 1: Update the token test to the new system (failing)**

Replace `tests/ui/designTokens.test.ts` entirely:

```ts
import { describe, expect, it } from 'vitest';
import { experienceDesignTokens } from '../../src/ui/designTokens';

describe('experienceDesignTokens', () => {
  it('exposes the unified learner-friendly palette', () => {
    expect(experienceDesignTokens.color.brand).toBe('#f2b705');
    expect(experienceDesignTokens.color.brandStrong).toBe('#b77900');
    expect(experienceDesignTokens.color.brandSoft).toBe('#fff4bf');
    expect(experienceDesignTokens.color.bg).toBe('#f6f7f8');
    expect(experienceDesignTokens.color.surface).toBe('#ffffff');
    expect(experienceDesignTokens.color.text).toBe('#18181b');
    expect(experienceDesignTokens.color.danger).toBe('#d92d20');
    expect(experienceDesignTokens.color.success).toBe('#16833a');
  });

  it('uses friendly geometry and readable type', () => {
    expect(experienceDesignTokens.radius.card).toBe('12px');
    expect(experienceDesignTokens.radius.control).toBe('8px');
    expect(experienceDesignTokens.type.title).toBe('24px');
    expect(experienceDesignTokens.type.body).toBe('14px');
  });

  it('defines a fixed accent per learning skill', () => {
    expect(Object.keys(experienceDesignTokens.skill)).toEqual([
      'grammar', 'vocabulary', 'listening', 'reading', 'writing', 'speaking',
    ]);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run tests/ui/designTokens.test.ts`
Expected: FAIL (`color.brand` undefined; old shape).

- [ ] **Step 3: Rewrite `src/ui/designTokens.ts`**

```ts
export const experienceDesignTokens = {
  color: {
    bg: '#f6f7f8',
    surface: '#ffffff',
    surfaceSoft: '#f8fafc',
    border: '#dfe3e8',
    borderStrong: '#c5cad3',
    text: '#18181b',
    textMuted: '#666f7b',
    brand: '#f2b705',
    brandStrong: '#b77900',
    brandSoft: '#fff4bf',
    danger: '#d92d20',
    dangerSoft: '#fff1ef',
    success: '#16833a',
    successSoft: '#e8f7ee',
    info: '#1d4ed8',
    infoSoft: '#eaf0ff',
  },
  skill: {
    grammar: '#1d4ed8',
    vocabulary: '#16833a',
    listening: '#7c3aed',
    reading: '#0f766e',
    writing: '#b45309',
    speaking: '#be123c',
  },
  radius: { card: '12px', control: '8px', pill: '999px' },
  type: { title: '24px', section: '16px', body: '14px', label: '12px' },
  layout: { sidebarWidth: '216px', contentMaxWidth: '1180px', appMinWidth: '320px' },
} as const;
```

- [ ] **Step 4: Replace the `:root` block in `src/index.css` and add `@theme`**

Replace lines 3–21 (the `:root { --db-* }` block) with:

```css
@theme {
  --color-bg: #f6f7f8;
  --color-surface: #ffffff;
  --color-surface-soft: #f8fafc;
  --color-border: #dfe3e8;
  --color-border-strong: #c5cad3;
  --color-text: #18181b;
  --color-text-muted: #666f7b;
  --color-brand: #f2b705;
  --color-brand-strong: #b77900;
  --color-brand-soft: #fff4bf;
  --color-danger: #d92d20;
  --color-danger-soft: #fff1ef;
  --color-success: #16833a;
  --color-success-soft: #e8f7ee;
  --color-info: #1d4ed8;
  --color-info-soft: #eaf0ff;
  --color-skill-grammar: #1d4ed8;
  --color-skill-vocabulary: #16833a;
  --color-skill-listening: #7c3aed;
  --color-skill-reading: #0f766e;
  --color-skill-writing: #b45309;
  --color-skill-speaking: #be123c;
  --radius-card: 12px;
  --radius-control: 8px;
  --radius-pill: 999px;
  --shadow-soft: 0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px rgb(15 23 42 / 0.06);
  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
}

/* Legacy aliases kept until every .db-* block is removed (Task 13). */
:root {
  --db-bg: var(--color-bg);
  --db-surface: var(--color-surface);
  --db-surface-soft: var(--color-surface-soft);
  --db-surface-muted: #eef2f5;
  --db-text: var(--color-text);
  --db-text-soft: #374151;
  --db-muted: var(--color-text-muted);
  --db-border: var(--color-border);
  --db-border-soft: #e7ebf0;
  --db-accent: var(--color-brand);
  --db-accent-strong: var(--color-brand-strong);
  --db-blue: var(--color-info);
  --db-green: var(--color-success);
  --db-red: var(--color-danger);
  --db-sidebar-width: 216px;
  --db-radius: 12px;
  --db-shadow: var(--shadow-soft);
}
```

Keeping the `--db-*` aliases means existing `.db-*` rules still render correctly (now in the new palette) until each page task deletes its rules. No page breaks mid-migration.

- [ ] **Step 5: Verify token test + full suite + build**

Run: `npx vitest run tests/ui/designTokens.test.ts` → PASS
Run: `npm run test:run` → 301 passed (no behavior changed; `.db-*` still styled via aliases)
Run: `npm run build` → succeeds

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/ui/designTokens.ts tests/ui/designTokens.test.ts
git commit -m "feat(ui): unified design tokens via Tailwind theme"
```

---

## Task 2: Kit primitives — `cn` + `tokens` + `Button`

**Files:**
- Create: `components/ui/cn.ts`, `components/ui/tokens.ts`, `components/ui/Button.tsx`
- Test: `tests/components/ui/Button.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// tests/components/ui/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../../components/ui/Button';

describe('Button', () => {
  it('renders label and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Start exam</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Start exam' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and shows busy state while loading', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button', { name: /Save/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('applies the variant class', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-danger');
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run tests/components/ui/Button.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// components/ui/cn.ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
```

```ts
// components/ui/tokens.ts
export const SKILL_COLORS = {
  grammar: 'skill-grammar',
  vocabulary: 'skill-vocabulary',
  listening: 'skill-listening',
  reading: 'skill-reading',
  writing: 'skill-writing',
  speaking: 'skill-speaking',
} as const;
export type SkillKey = keyof typeof SKILL_COLORS;
```

```tsx
// components/ui/Button.tsx
import React from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-text hover:bg-brand-strong hover:text-white',
  secondary: 'bg-surface-soft text-text border border-border hover:bg-border/40',
  ghost: 'bg-transparent text-text-muted hover:bg-surface-soft',
  danger: 'bg-danger text-white hover:brightness-95',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
      size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-[14px]',
      VARIANTS[variant],
      className,
    )}
  >
    {loading ? <span className="animate-spin">◌</span> : icon}
    {children}
  </button>
);
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/components/ui/Button.test.tsx` → PASS (3)

- [ ] **Step 5: Commit**

```bash
git add components/ui/cn.ts components/ui/tokens.ts components/ui/Button.tsx tests/components/ui/Button.test.tsx
git commit -m "feat(ui): add Button primitive and kit helpers"
```

---

## Task 3: `Card`, `PageHeader`, `Stat`

**Files:**
- Create: `components/ui/Card.tsx`, `components/ui/PageHeader.tsx`, `components/ui/Stat.tsx`
- Test: `tests/components/ui/Card.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// tests/components/ui/Card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Stat } from '../../../components/ui/Stat';

describe('Card/PageHeader/Stat', () => {
  it('Card renders children and optional title', () => {
    render(<Card title="Today">body</Card>);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('PageHeader renders title, subtitle, actions', () => {
    render(<PageHeader title="Dashboard" subtitle="Heute" actions={<button>Go</button>} />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Heute')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('Stat renders label and value', () => {
    render(<Stat label="Progress" value="72%" />);
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fail.** `npx vitest run tests/components/ui/Card.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

```tsx
// components/ui/Card.tsx
import React from 'react';
import { cn } from './cn';

export interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'default' | 'soft' | 'interactive';
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
}

export const Card: React.FC<CardProps> = ({
  children, title, actions, footer, variant = 'default', className, onClick, ...rest
}) => (
  <section
    {...rest}
    onClick={onClick}
    className={cn(
      'rounded-card border border-border bg-surface p-5 shadow-soft',
      variant === 'soft' && 'bg-surface-soft shadow-none',
      variant === 'interactive' && 'cursor-pointer transition-colors hover:border-brand',
      className,
    )}
  >
    {(title || actions) && (
      <div className="mb-4 flex items-center justify-between gap-3">
        {title && <h2 className="text-[16px] font-semibold text-text">{title}</h2>}
        {actions}
      </div>
    )}
    {children}
    {footer && <div className="mt-4 border-t border-border pt-3">{footer}</div>}
  </section>
);
```

```tsx
// components/ui/PageHeader.tsx
import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
  <header className="mb-6 flex items-end justify-between gap-4">
    <div>
      <h1 className="text-[24px] font-bold tracking-tight text-text">{title}</h1>
      {subtitle && <p className="mt-1 text-[14px] text-text-muted">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </header>
);
```

```tsx
// components/ui/Stat.tsx
import React from 'react';

export interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
}

export const Stat: React.FC<StatProps> = ({ label, value, hint }) => (
  <div className="rounded-card border border-border bg-surface p-4">
    <div className="text-[12px] font-medium uppercase tracking-wide text-text-muted">{label}</div>
    <div className="mt-1 text-[22px] font-bold text-text">{value}</div>
    {hint && <div className="mt-1 text-[12px] text-text-muted">{hint}</div>}
  </div>
);
```

- [ ] **Step 4: Run — verify pass.** `npx vitest run tests/components/ui/Card.test.tsx` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Card.tsx components/ui/PageHeader.tsx components/ui/Stat.tsx tests/components/ui/Card.test.tsx
git commit -m "feat(ui): add Card, PageHeader, Stat"
```

---

## Task 4: `Field`, `Badge`, `Notice`

**Files:**
- Create: `components/ui/Field.tsx`, `components/ui/Badge.tsx`, `components/ui/Notice.tsx`
- Test: `tests/components/ui/Field.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// tests/components/ui/Field.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { Notice } from '../../../components/ui/Notice';

describe('Field/Badge/Notice', () => {
  it('Field associates label with control via htmlFor/id', () => {
    render(<Field label="API key" htmlFor="k"><input id="k" /></Field>);
    expect(screen.getByLabelText('API key')).toBeInTheDocument();
  });

  it('Field shows error text', () => {
    render(<Field label="Email" htmlFor="e" error="Required"><input id="e" /></Field>);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('Badge renders tone', () => {
    render(<Badge tone="success">Configured</Badge>);
    expect(screen.getByText('Configured').className).toContain('bg-success-soft');
  });

  it('Notice renders role status/alert by tone', () => {
    render(<Notice tone="error">Failed</Notice>);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });
});
```

- [ ] **Step 2: Run — verify fail.** `npx vitest run tests/components/ui/Field.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

```tsx
// components/ui/Field.tsx
import React from 'react';

export interface FieldProps {
  label: string;
  htmlFor: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, description, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={htmlFor} className="text-[13px] font-medium text-text">{label}</label>
    {description && <p className="text-[12px] text-text-muted">{description}</p>}
    {children}
    {error && <p className="text-[12px] text-danger">{error}</p>}
  </div>
);
```

```tsx
// components/ui/Badge.tsx
import React from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-soft text-text-muted border-border',
  brand: 'bg-brand-soft text-brand-strong border-brand-soft',
  success: 'bg-success-soft text-success border-success-soft',
  danger: 'bg-danger-soft text-danger border-danger-soft',
  info: 'bg-info-soft text-info border-info-soft',
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral', children, className,
}) => (
  <span className={cn('inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[12px] font-medium', TONES[tone], className)}>
    {children}
  </span>
);
```

```tsx
// components/ui/Notice.tsx
import React from 'react';
import { cn } from './cn';

type Tone = 'info' | 'success' | 'error';

const TONES: Record<Tone, string> = {
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  error: 'bg-danger-soft text-danger',
};

export const Notice: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'info', children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-control px-3 py-2 text-[13px]', TONES[tone])}>
    {children}
  </div>
);
```

- [ ] **Step 4: Run — verify pass.** `npx vitest run tests/components/ui/Field.test.tsx` → PASS (4).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Field.tsx components/ui/Badge.tsx components/ui/Notice.tsx tests/components/ui/Field.test.tsx
git commit -m "feat(ui): add Field, Badge, Notice"
```

---

## Task 5: `ProgressBar`, `Ring`, `EmptyState`, `OptionCard`, `SegmentedControl`, barrel

**Files:**
- Create: `components/ui/ProgressBar.tsx`, `Ring.tsx`, `EmptyState.tsx`, `OptionCard.tsx`, `SegmentedControl.tsx`, `index.ts`
- Test: `tests/components/ui/widgets.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// tests/components/ui/widgets.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProgressBar, Ring, EmptyState, OptionCard, SegmentedControl } from '../../../components/ui';

describe('widgets', () => {
  it('ProgressBar exposes value via aria', () => {
    render(<ProgressBar value={42} label="Plan progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Plan progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
  });

  it('Ring renders percentage text', () => {
    render(<Ring value={80} label="Level" />);
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('EmptyState shows message and action', () => {
    const onAction = vi.fn();
    render(<EmptyState title="No exam" actionLabel="Retry" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('OptionCard toggles selected and fires select', () => {
    const onSelect = vi.fn();
    render(<OptionCard label="Free talk" selected onSelect={onSelect} />);
    const el = screen.getByRole('button', { name: /Free talk/ });
    expect(el).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(el);
    expect(onSelect).toHaveBeenCalled();
  });

  it('SegmentedControl selects an option', () => {
    const onChange = vi.fn();
    render(<SegmentedControl ariaLabel="Level" value="B1" options={[{ value: 'A1', label: 'A1' }, { value: 'B1', label: 'B1' }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'A1' }));
    expect(onChange).toHaveBeenCalledWith('A1');
  });
});
```

- [ ] **Step 2: Run — verify fail.** `npx vitest run tests/components/ui/widgets.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

```tsx
// components/ui/ProgressBar.tsx
import React from 'react';
export const ProgressBar: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-pill bg-surface-soft">
      <div className="h-full rounded-pill bg-brand" style={{ width: `${v}%` }} />
    </div>
  );
};
```

```tsx
// components/ui/Ring.tsx
import React from 'react';
export const Ring: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex flex-col items-center" aria-label={label}>
      <div className="grid h-20 w-20 place-items-center rounded-pill text-[18px] font-bold text-text"
        style={{ background: `conic-gradient(var(--color-brand) ${v}%, var(--color-surface-soft) 0)` }}>
        <span className="grid h-14 w-14 place-items-center rounded-pill bg-surface">{v}%</span>
      </div>
      <span className="mt-1 text-[12px] text-text-muted">{label}</span>
    </div>
  );
};
```

```tsx
// components/ui/EmptyState.tsx
import React from 'react';
import { Button } from './Button';
export const EmptyState: React.FC<{
  title: string; description?: string; icon?: React.ReactNode;
  actionLabel?: string; onAction?: () => void;
}> = ({ title, description, icon, actionLabel, onAction }) => (
  <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface-soft p-10 text-center">
    {icon && <div className="text-text-muted">{icon}</div>}
    <h3 className="text-[16px] font-semibold text-text">{title}</h3>
    {description && <p className="max-w-md text-[13px] text-text-muted">{description}</p>}
    {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
  </div>
);
```

```tsx
// components/ui/OptionCard.tsx
import React from 'react';
import { cn } from './cn';
export const OptionCard: React.FC<{
  label: string; description?: string; icon?: React.ReactNode;
  selected?: boolean; disabled?: boolean; onSelect: () => void;
}> = ({ label, description, icon, selected, disabled, onSelect }) => (
  <button type="button" disabled={disabled} aria-pressed={!!selected} onClick={onSelect}
    className={cn(
      'flex flex-col gap-1 rounded-card border p-4 text-left transition-colors disabled:opacity-50',
      selected ? 'border-brand bg-brand-soft' : 'border-border bg-surface hover:border-brand',
    )}>
    <span className="flex items-center gap-2 text-[14px] font-semibold text-text">{icon}{label}</span>
    {description && <span className="text-[12px] text-text-muted">{description}</span>}
  </button>
);
```

```tsx
// components/ui/SegmentedControl.tsx
import React from 'react';
import { cn } from './cn';
export interface SegOption { value: string; label: string }
export const SegmentedControl: React.FC<{
  ariaLabel: string; value: string; options: SegOption[]; onChange: (v: string) => void;
}> = ({ ariaLabel, value, options, onChange }) => (
  <div role="group" aria-label={ariaLabel} className="inline-flex rounded-control border border-border bg-surface p-1">
    {options.map(o => (
      <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
        className={cn('rounded-[6px] px-3 py-1.5 text-[13px] font-medium',
          o.value === value ? 'bg-brand text-text' : 'text-text-muted hover:bg-surface-soft')}>
        {o.label}
      </button>
    ))}
  </div>
);
```

```ts
// components/ui/index.ts
export { Button } from './Button';
export { Card } from './Card';
export { PageHeader } from './PageHeader';
export { Stat } from './Stat';
export { Field } from './Field';
export { Badge } from './Badge';
export { Notice } from './Notice';
export { ProgressBar } from './ProgressBar';
export { Ring } from './Ring';
export { EmptyState } from './EmptyState';
export { OptionCard } from './OptionCard';
export { SegmentedControl } from './SegmentedControl';
export { cn } from './cn';
export { SKILL_COLORS } from './tokens';
export type { SkillKey } from './tokens';
```

- [ ] **Step 4: Run — verify pass.** `npx vitest run tests/components/ui/widgets.test.tsx` → PASS (5).

- [ ] **Step 5: Full suite + commit**

Run: `npm run test:run` → green; `npm run build` → ok

```bash
git add components/ui tests/components/ui/widgets.test.tsx
git commit -m "feat(ui): add ProgressBar, Ring, EmptyState, OptionCard, SegmentedControl + barrel"
```

---

## Task 6: Refactor `ExperienceAppShell` onto the kit

**Files:**
- Modify: `components/ExperienceAppShell.tsx`
- Modify: `src/index.css` (delete shell/nav/window-bar/status `.db-*` rules: `.db-shell`, `.db-sidebar*`, `.db-brand*`, `.db-flag`, `.db-nav*`, `.db-sidebar-status`, `.db-status-dot*`, `.db-main-frame`, `.db-window-bar`, `.db-page-context`, `.db-window-status`, `.db-status-pill*`)
- Guard test: `tests/components/ExperienceAppShell.test.tsx` (unchanged — must stay green)

- [ ] **Step 1: Read the guard test and the current shell**

Run: `npx vitest run tests/components/ExperienceAppShell.test.tsx` (baseline green, 17).
Read `components/ExperienceAppShell.tsx` and the test fully. Enumerate every role/label/text it asserts (nav links, brand, status). These are the contract.

- [ ] **Step 2: Rewrite the shell JSX with Tailwind + kit**

Replace `.db-shell/.db-sidebar/.db-nav/.db-window-bar` markup with Tailwind utilities bound to theme tokens (`bg-surface`, `border-border`, `w-[216px]`, etc.). Keep the exact component API, props, route list, `NavLink` targets, `aria-label`s, brand text, and status text. Use `Badge` for status pills. Preserve the responsive bottom-nav behavior (Tailwind `max-[860px]:` variants).

- [ ] **Step 3: Delete the shell `.db-*` rules from `src/index.css`**

Remove only the selectors listed in Files above. Leave other `.db-*` rules.

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/components/ExperienceAppShell.test.tsx` → 17 PASS
Run: `npm run test:run` → 301 + kit tests, all green
Run: `npm run build` → ok

- [ ] **Step 5: Commit**

```bash
git add components/ExperienceAppShell.tsx src/index.css
git commit -m "feat(ui): convert AppShell to shared kit"
```

---

## Tasks 7–15: Page conversions (same shape)

Each task below follows the **Conversion Contract** and this identical 5-step shape. The executor reads the page + its guard test, rewrites JSX to compose `components/ui`, deletes that page's `.db-*` rules, and verifies. Listed per task: the page file, guard test, kit components to use, and the `.db-*` selector groups to remove.

### Task 7: Dashboard
- Files: `pages/LocalDashboardPage.tsx`; guard `tests/pages/LocalDashboardPage.test.tsx`; CSS remove `.db-dashboard*`, `.db-level-meter`, `.db-ring`, `.db-next-action*`, `.db-queue*`, `.db-review-panel`, `.db-weak*`, `.db-weekly*`, `.db-stat*`, `.db-progress-track`, `.db-session-panel`, `.db-source-marker*`, `.db-tone-*`, `.db-section-label`.
- Kit: `PageHeader`, `Card`, `Stat`, `Ring`, `ProgressBar`, `Badge`, `Button`.
- [ ] Read page + guard test; list asserted roles/labels/text.
- [ ] Rewrite JSX composing the kit; preserve contract.
- [ ] Delete listed `.db-*` rules from `src/index.css`.
- [ ] `npm run test:run` green + `npm run build` ok.
- [ ] Commit `feat(ui): convert Dashboard to shared kit`.

### Task 8: Activity
- Files: `pages/ActivityPage.tsx`; guards `tests/pages/ActivityPage.completion.test.tsx`, `tests/pages/ActivityPage.voice.test.tsx`; CSS remove Activity-only ad-hoc rules (any `.db-activity*` if present; otherwise none — page is mostly inline).
- Kit: `PageHeader`, `Card`, `Button`, `Field` (writing textarea), `Badge`, `ProgressBar`, `EmptyState`, `Notice`.
- [ ] Read page + both guard tests; list asserted roles/labels/text/placeholders.
- [ ] Rewrite JSX composing the kit for prepare→active→result across the 6 activity types; preserve contract.
- [ ] Remove any Activity-only `.db-*`/inline style blocks.
- [ ] `npm run test:run` green + `npm run build` ok.
- [ ] Commit `feat(ui): convert Activity to shared kit`.

### Task 9: Conversation
- Files: `pages/SpeakingActivityPage.tsx`; guard `tests/pages/SpeakingActivityPage.test.tsx`; CSS remove `.db-conversation*`, `.db-live-*`, `.db-transcript*`, `.db-mode-*`, `.db-interim-transcript`, `.db-streaming-tutor-text`, `.db-icon-button`.
- Kit: `PageHeader`, `Card`, `OptionCard` (modes), `Badge` (live status), `Button`, `EmptyState`.
- [ ] Read page + guard test; list asserted roles/labels/text (transcript labels, control buttons, status text).
- [ ] Rewrite JSX; map live status to a calm `Badge` tone (listening=info, speaking=brand, error=danger); preserve contract.
- [ ] Delete listed `.db-*` rules.
- [ ] `npm run test:run` green + `npm run build` ok.
- [ ] Commit `feat(ui): convert Conversation to shared kit`.

### Task 10: Exam
- Files: `pages/ExamSimulatorPage.tsx`; guard `tests/pages/ExamSimulatorPage.test.tsx` (52 — heaviest contract); CSS remove the entire `.db-exam-*` family.
- Kit: `PageHeader`, `SegmentedControl` (level), `Card`, `OptionCard` (sections), `Button`, `ProgressBar`/`Ring` (timer/score), `Badge`, `Notice`, `EmptyState` (loud-fail + retry).
- [ ] Read page + guard test; list every asserted role/label/text (level buttons `name: /B1/i` with `aria-pressed`, "Generate and start exam", "Play listening audio for question N", "Next module", "Submit exam and show result", headings `Hoeren - Listening` etc., "Exam result", history labels, "Exam generation failed").
- [ ] Rewrite JSX composing the kit; preserve every contract string/role exactly.
- [ ] Delete the `.db-exam-*` rules.
- [ ] `npm run test:run` green (watch the heavy ExamSimulator file) + `npm run build` ok.
- [ ] Commit `feat(ui): convert Exam to shared kit`.

### Task 11: Placement
- Files: `pages/EnhancedPlacementTestPage.tsx`; guard `tests/pages/EnhancedPlacementTestPage.test.tsx`; CSS remove any placement-only ad-hoc rules.
- Kit: `PageHeader`, `Card`, `Field`, `Button`, `ProgressBar` (section progress), `EmptyState`, `Notice`.
- [ ] Read page + guard test; list asserted roles/labels/text.
- [ ] Rewrite JSX with visible section progress; preserve contract.
- [ ] Remove placement-only `.db-*`/inline blocks.
- [ ] `npm run test:run` green + `npm run build` ok.
- [ ] Commit `feat(ui): convert Placement to shared kit`.

### Task 12: Settings
- Files: `pages/LocalSettingsPage.tsx`; guard `tests/pages/LocalSettingsPage.test.tsx` (48); CSS remove `.db-settings-*`, `.db-field*`, `.db-toggle-row`, `.db-inline-button`, `.db-provider-*`.
- Kit: `PageHeader`, `Card` (one per provider), `Field`, `Button`, `Badge` (configured/error), `Notice` (test result), `SegmentedControl`/select.
- [ ] Read page + guard test; list asserted roles/labels/text (field labels, test buttons, messages).
- [ ] Rewrite JSX; preserve every field label and message string exactly.
- [ ] Delete listed `.db-*` rules.
- [ ] `npm run test:run` green + `npm run build` ok.
- [ ] Commit `feat(ui): convert Settings to shared kit`.

### Task 13: Profile
- Files: `pages/ProfilePage.tsx`; guard `tests/pages/ProfilePage.test.tsx`; CSS remove `.db-profile-*` (and any remaining `.db-settings-*` shared only with Profile).
- Kit: `PageHeader`, `Card`, `Field`, `Button`, `Badge`, `Notice` (saved state).
- [ ] Read page + guard test; list asserted roles/labels/text.
- [ ] Rewrite JSX; add saved-state `Notice`; preserve contract.
- [ ] Delete listed `.db-*` rules.
- [ ] `npm run test:run` green + `npm run build` ok.
- [ ] Commit `feat(ui): convert Profile to shared kit`.

### Task 14: Plan & Practice (no visual regression)
- Files: `pages/LearningPlanPage.tsx`, `pages/PracticePage.tsx`; guards `tests/pages/LearningPlanPage.test.tsx`, `tests/pages/PracticePage.test.tsx`; also replace usages of legacy `components/Card.tsx` with `components/ui/Card`.
- Kit: `PageHeader`, `Card`, `Stat`, `Button`, `Badge`, `OptionCard` (Practice skill cards), `ProgressBar`.
- [ ] Read both pages + guard tests; list asserted roles/labels/text.
- [ ] Rewrite both to compose the kit. Target: same or better look (these are the reference). Keep gradients out per the chosen "friendly & cohesive" language; keep layout/hierarchy/spacing equivalent so it does not feel worse.
- [ ] Delete the old `components/Card.tsx` (now unused) and any Plan/Practice-only `.db-*`.
- [ ] `npm run test:run` green + `npm run build` ok.
- [ ] Commit `feat(ui): convert Plan and Practice to shared kit`.

### Task 15: Placeholder workspaces + final purge
- Files: `pages` placeholder component (`LocalWorkspacePlaceholderPage` in `MainApp.tsx` or its own file); `src/index.css`.
- Kit: `PageHeader`, `EmptyState`.
- [ ] Convert the 4 placeholder routes (`/review`, `/writing`, `/mistakes`, `/library`) to `PageHeader` + `EmptyState` ("Coming soon" message). Preserve any asserted text.
- [ ] Delete remaining `.db-*` rules (`.db-panel*`, `.db-empty-workspace`, `.db-local-save`, `.db-muted-copy`, `.db-primary-button`, `.db-secondary-button`, `.db-danger-button`, and any stragglers). Remove the legacy `:root { --db-* }` alias block from Task 1.
- [ ] **Guard:** `git grep -nE "\.db-|className=\"db-|'db-" src pages components` returns **no matches** (CSS rules and JSX usages all gone). If matches remain, fix them before commit.
- [ ] `npm run test:run` green + `npm run build` ok.
- [ ] Commit `feat(ui): convert placeholder workspaces and purge legacy db- styles`.

---

## Task 16: Final verification

- [ ] `npm run test:run` → all green (301 baseline + kit tests; only `tests/ui/designTokens.test.ts` intentionally changed).
- [ ] `npm run build` → succeeds (pre-existing chunk-size warning only).
- [ ] `git grep -nE "\.db-" -- src/index.css` → no output.
- [ ] `git grep -nE "className=(\"|')db-" -- pages components` → no output.
- [ ] Confirm no new feature/routing/provider/AI/audio logic changed (`git diff master --stat` is presentation + kit + token files only).
- [ ] Commit any final cleanup: `chore(ui): verify unified UI system (suite + build green)`.

---

## Self-Review

- **Spec coverage:** Foundation tokens → Task 1. Component kit (all 12 + shell) → Tasks 2–6. Page conversion map & order (Dashboard→…→Plan/Practice→placeholders) → Tasks 7–15. Migration/non-breaking/accessibility → Conversion Contract + Task 1 alias strategy. Testing/scope/success → per-task verification + Task 16. No spec section unaddressed.
- **Placeholder scan:** Kit tasks contain full component + test code. Page tasks are deliberately recipe+contract+verify (justified: 200–900-line files, comprehensive existing guard tests are the oracle, no `.db-*` test coupling) — this is concrete (exact files, exact CSS selectors, exact contract source, exact verify commands), not hand-waving.
- **Type/name consistency:** Kit barrel `components/ui/index.ts` exports match component names used in page tasks (`PageHeader`, `Card`, `Button`, `Field`, `Stat`, `Badge`, `Notice`, `ProgressBar`, `Ring`, `EmptyState`, `OptionCard`, `SegmentedControl`). Token names in `@theme` (`--color-brand`, `--radius-card`) match Tailwind utilities used in components (`bg-brand`, `rounded-card`) and `designTokens.ts` keys match the updated token test.
