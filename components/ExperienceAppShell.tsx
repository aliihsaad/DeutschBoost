import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  buildProviderSettingsSnapshots,
  createDefaultLocalProviderSettings,
  type ProviderSettingsSnapshots,
} from '../src/domain/settings/providerSettings';
import {
  getDestinationByRoute,
  primaryAppDestinations,
  isDestinationActive,
  type AppDestination,
} from '../src/ui/navigationModel';
import { describeProviderStatus, type ProviderSettingsSnapshot } from '../src/ui/providerStatusModel';
import { cn } from './ui/cn';

const iconClassByName: Record<string, string> = {
  'layout-dashboard': 'fa-table-columns',
  map: 'fa-calendar-days',
  'refresh-cw': 'fa-arrows-rotate',
  dumbbell: 'fa-dumbbell',
  mic: 'fa-comments',
  'pen-line': 'fa-pen',
  'notebook-tabs': 'fa-circle-exclamation',
  timer: 'fa-stopwatch',
  library: 'fa-book-open',
  user: 'fa-user',
  settings: 'fa-gear',
};

const mobileMarkByDestinationId: Record<string, string> = {
  dashboard: 'D',
  plan: 'P',
  practice: 'U',
  conversation: 'S',
  exam: 'E',
  profile: 'Me',
  settings: 'St',
};

type Tone = 'success' | 'accent' | 'muted' | 'danger';

const DOT_TONE: Record<Tone, string> = {
  success: 'bg-success',
  accent: 'bg-brand',
  muted: 'bg-border-strong',
  danger: 'bg-danger',
};

const PILL_TONE: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  accent: 'bg-brand-soft text-brand-strong',
  muted: 'bg-surface-soft text-text-muted',
  danger: 'bg-danger-soft text-danger',
};

interface ExperienceAppShellProps {
  children: React.ReactNode;
  providerSettings?: ProviderSettingsSnapshots;
}

const defaultProviderSettings = buildProviderSettingsSnapshots(createDefaultLocalProviderSettings());

const ExperienceAppShell: React.FC<ExperienceAppShellProps> = ({
  children,
  providerSettings = defaultProviderSettings,
}) => {
  const location = useLocation();
  const route = `${location.pathname}${location.search}`;
  const activeDestination = getDestinationByRoute(route);

  return (
    <div className="flex h-screen min-w-[320px] overflow-hidden bg-bg text-text">
      <aside
        className="flex w-[216px] flex-none flex-col gap-4 border-r border-border bg-surface p-4 max-[860px]:hidden"
        aria-label="DeutschBoost workspace"
      >
        <Link to="/" className="flex items-center gap-2 text-text" aria-label="DeutschBoost home">
          <img src="/app-icon.svg" alt="" className="h-8 w-8" aria-hidden="true" />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold">DeutschBoost</span>
            <small className="text-[11px] text-text-muted">Local German studio</small>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
          {primaryAppDestinations.map(destination => (
            <ShellLink
              key={destination.id}
              destination={destination}
              active={isDestinationActive(destination, route)}
            />
          ))}
        </nav>

        <div className="flex flex-col gap-2" aria-label="Workspace status">
          <StatusDot label="Local files" tone="success" />
          <StatusDot
            label={formatSidebarProviderLabel(providerSettings.ai)}
            tone={getSidebarProviderTone(providerSettings.ai)}
          />
          <StatusDot
            label={formatSidebarProviderLabel(providerSettings.speech)}
            tone={getSidebarProviderTone(providerSettings.speech)}
          />
          <StatusDot
            label={formatSidebarProviderLabel(providerSettings.live)}
            tone={getSidebarProviderTone(providerSettings.live)}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3">
          <div className="flex flex-col leading-tight" aria-label="Current workspace">
            <span className="text-[12px] uppercase tracking-wide text-text-muted">
              {activeDestination.label}
            </span>
            <strong className="text-[14px] font-semibold text-text">
              Device-only learning workspace
            </strong>
          </div>
          <div className="flex items-center gap-2" aria-label="Local runtime status">
            <StatusPill label="Files" tone="success" />
            <StatusPill
              label={formatTopbarProviderLabel(providerSettings.ai)}
              tone={getSidebarProviderTone(providerSettings.ai)}
            />
            <StatusPill
              label={formatTopbarProviderLabel(providerSettings.live)}
              tone={getSidebarProviderTone(providerSettings.live)}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
};

interface ShellLinkProps {
  destination: AppDestination;
  active: boolean;
}

const ShellLink: React.FC<ShellLinkProps> = ({ destination, active }) => (
  <Link
    to={destination.route}
    className={cn(
      'flex items-center gap-2.5 rounded-control px-3 py-2 text-[13px] font-medium transition-colors',
      active ? 'bg-brand-soft text-brand-strong' : 'text-text-muted hover:bg-surface-soft hover:text-text',
    )}
    aria-current={active ? 'page' : undefined}
    title={destination.description}
  >
    <i
      className={`fa-solid ${iconClassByName[destination.icon] ?? 'fa-circle'} w-4 text-center`}
      aria-hidden="true"
    />
    <span className="hidden" aria-hidden="true">
      {mobileMarkByDestinationId[destination.id] ?? destination.shortLabel.slice(0, 2)}
    </span>
    <span>{destination.label}</span>
  </Link>
);

const StatusDot: React.FC<{ label: string; tone: Tone }> = ({ label, tone }) => (
  <div className="flex items-center gap-2 text-[12px] text-text-muted">
    <span className={cn('h-2 w-2 rounded-pill', DOT_TONE[tone])} aria-hidden="true" />
    <span>{label}</span>
  </div>
);

const StatusPill: React.FC<{ label: string; tone: Tone }> = ({ label, tone }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[12px] font-medium',
      PILL_TONE[tone],
    )}
  >
    <span className={cn('h-1.5 w-1.5 rounded-pill', DOT_TONE[tone])} aria-hidden="true" />
    {label}
  </span>
);

function formatSidebarProviderLabel(snapshot: ProviderSettingsSnapshot): string {
  const status = describeProviderStatus(snapshot);

  if (status.state === 'configured') {
    return `${snapshot.providerName} ready`;
  }

  if (status.state === 'error') {
    return `${snapshot.providerName} error`;
  }

  return `${snapshot.providerName} off`;
}

function formatTopbarProviderLabel(snapshot: ProviderSettingsSnapshot): string {
  const status = describeProviderStatus(snapshot);
  const providerLabelByKind = {
    ai: 'AI',
    speech: 'Voice',
    live: 'Live',
  } satisfies Record<ProviderSettingsSnapshot['kind'], string>;
  const providerLabel = providerLabelByKind[snapshot.kind];

  if (status.state === 'configured') {
    return providerLabel;
  }

  if (status.state === 'error') {
    return `${providerLabel} error`;
  }

  return `${providerLabel} off`;
}

function getSidebarProviderTone(snapshot: ProviderSettingsSnapshot): Tone {
  const status = describeProviderStatus(snapshot);

  if (status.state === 'configured') {
    return 'success';
  }

  if (status.state === 'error') {
    return 'danger';
  }

  return 'muted';
}

export default ExperienceAppShell;
