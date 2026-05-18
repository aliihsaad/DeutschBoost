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
    <div className="db-shell">
      <aside className="db-sidebar" aria-label="DeutschBoost workspace">
        <Link to="/" className="db-brand" aria-label="DeutschBoost home">
          <img src="/app-icon.svg" alt="" className="db-brand-mark" aria-hidden="true" />
          <span>
            DeutschBoost
            <small>Local German studio</small>
          </span>
        </Link>

        <nav className="db-nav" aria-label="Primary">
          {primaryAppDestinations.map(destination => (
            <ShellLink
              key={destination.id}
              destination={destination}
              active={isDestinationActive(destination, route)}
            />
          ))}
        </nav>

        <div className="db-sidebar-status" aria-label="Workspace status">
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

      <div className="db-main-frame">
        <div className="db-window-bar">
          <div className="db-page-context" aria-label="Current workspace">
            <span>{activeDestination.label}</span>
            <strong>Device-only learning workspace</strong>
          </div>
          <div className="db-window-status" aria-label="Local runtime status">
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
        {children}
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
    className={`db-nav-link${active ? ' is-active' : ''}`}
    aria-current={active ? 'page' : undefined}
    title={destination.description}
>
  <i className={`fa-solid ${iconClassByName[destination.icon] ?? 'fa-circle'} db-nav-icon`} aria-hidden="true" />
  <span className="db-nav-fallback" aria-hidden="true">
    {mobileMarkByDestinationId[destination.id] ?? destination.shortLabel.slice(0, 2)}
  </span>
  <span className="db-nav-label">{destination.label}</span>
</Link>
);

interface StatusDotProps {
  label: string;
  tone: 'success' | 'accent' | 'muted' | 'danger';
}

const StatusDot: React.FC<StatusDotProps> = ({ label, tone }) => (
  <div className="db-status-dot-row">
    <span className={`db-status-dot db-status-dot-${tone}`} aria-hidden="true" />
    <span>{label}</span>
  </div>
);

const StatusPill: React.FC<StatusDotProps> = ({ label, tone }) => (
  <span className={`db-status-pill db-status-pill-${tone}`}>
    <span className={`db-status-dot db-status-dot-${tone}`} aria-hidden="true" />
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

function getSidebarProviderTone(snapshot: ProviderSettingsSnapshot): StatusDotProps['tone'] {
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
