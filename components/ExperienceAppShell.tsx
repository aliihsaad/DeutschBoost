import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  buildProviderSettingsSnapshots,
  createDefaultLocalProviderSettings,
  type ProviderSettingsSnapshots,
} from '../src/domain/settings/providerSettings';
import { primaryAppDestinations, isDestinationActive, type AppDestination } from '../src/ui/navigationModel';
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

  return (
    <div className="db-shell">
      <aside className="db-sidebar" aria-label="DeutschBoost workspace">
        <Link to="/" className="db-brand" aria-label="DeutschBoost home">
          <span className="db-flag" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>DeutschBoost</span>
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
        </div>
      </aside>

      <div className="db-main-frame">
        <div className="db-window-bar" aria-hidden="true">
          <span />
          <span />
          <span />
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
    <span>{destination.label}</span>
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
