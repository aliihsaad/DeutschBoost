export type AppDestinationId =
  | 'dashboard'
  | 'plan'
  | 'review'
  | 'practice'
  | 'conversation'
  | 'writing'
  | 'mistakes'
  | 'exam'
  | 'library'
  | 'profile'
  | 'settings';

export type AppDestinationGroup = 'learn' | 'practice' | 'memory' | 'system';

export interface AppDestination {
  id: AppDestinationId;
  label: string;
  shortLabel: string;
  route: string;
  icon: string;
  group: AppDestinationGroup;
  description: string;
  legacyRoutes: string[];
  availability: 'ready' | 'planned';
}

export const appDestinations: AppDestination[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    route: '/',
    icon: 'layout-dashboard',
    group: 'learn',
    description: 'Daily queue, next action, weak areas, and current learning status.',
    legacyRoutes: ['/home', '/placement-test'],
    availability: 'ready',
  },
  {
    id: 'plan',
    label: 'Plan',
    shortLabel: 'Plan',
    route: '/plan',
    icon: 'map',
    group: 'learn',
    description: 'Weekly path, upcoming lessons, completed items, and level goals.',
    legacyRoutes: ['/learning-plan'],
    availability: 'ready',
  },
  {
    id: 'review',
    label: 'Review',
    shortLabel: 'Review',
    route: '/review',
    icon: 'refresh-cw',
    group: 'memory',
    description: 'Due vocabulary, phrases, grammar mistakes, and saved corrections.',
    legacyRoutes: [],
    availability: 'planned',
  },
  {
    id: 'practice',
    label: 'Practice',
    shortLabel: 'Practice',
    route: '/practice',
    icon: 'dumbbell',
    group: 'practice',
    description: 'Free practice by skill, level, topic, and exam target.',
    legacyRoutes: ['/activity'],
    availability: 'ready',
  },
  {
    id: 'conversation',
    label: 'Conversation',
    shortLabel: 'Speak',
    route: '/conversation',
    icon: 'mic',
    group: 'practice',
    description: 'Text and push-to-talk tutor sessions with local transcript history.',
    legacyRoutes: ['/speaking-activity'],
    availability: 'ready',
  },
  {
    id: 'writing',
    label: 'Writing',
    shortLabel: 'Write',
    route: '/writing',
    icon: 'pen-line',
    group: 'practice',
    description: 'Prompts, drafts, feedback, revisions, and saved corrections.',
    legacyRoutes: [],
    availability: 'planned',
  },
  {
    id: 'mistakes',
    label: 'Mistakes',
    shortLabel: 'Mistakes',
    route: '/mistakes',
    icon: 'notebook-tabs',
    group: 'memory',
    description: 'Searchable notebook of grammar, vocabulary, pronunciation, and writing issues.',
    legacyRoutes: [],
    availability: 'planned',
  },
  {
    id: 'exam',
    label: 'Exam',
    shortLabel: 'Exam',
    route: '/exam',
    icon: 'timer',
    group: 'practice',
    description: 'Goethe-style timed practice and local reports.',
    legacyRoutes: ['/exam-simulator'],
    availability: 'ready',
  },
  {
    id: 'library',
    label: 'Library',
    shortLabel: 'Library',
    route: '/library',
    icon: 'library',
    group: 'learn',
    description: 'Saved readings, listening items, grammar notes, and local content packs.',
    legacyRoutes: [],
    availability: 'planned',
  },
  {
    id: 'profile',
    label: 'Profile',
    shortLabel: 'Profile',
    route: '/profile',
    icon: 'user',
    group: 'system',
    description: 'Local learner level, goals, study rhythm, and personalization.',
    legacyRoutes: [],
    availability: 'ready',
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    route: '/settings',
    icon: 'settings',
    group: 'system',
    description: 'Files, backups, AI provider, speech provider, and privacy.',
    legacyRoutes: [],
    availability: 'ready',
  },
];

export const primaryAppDestinations = appDestinations.filter(
  destination => destination.availability === 'ready'
);

const destinationById = new Map<AppDestinationId, AppDestination>(
  appDestinations.map(destination => [destination.id, destination])
);

export function getDestinationById(id: AppDestinationId): AppDestination {
  const destination = destinationById.get(id);

  if (!destination) {
    throw new Error(`Unknown app destination: ${id}`);
  }

  return destination;
}

export function getDestinationByRoute(pathnameWithSearch: string): AppDestination {
  const pathname = normalizePathname(pathnameWithSearch);

  return (
    appDestinations.find(destination => routeMatchesDestination(destination, pathname)) ??
    getDestinationById('dashboard')
  );
}

export function isDestinationActive(destination: AppDestination, pathnameWithSearch: string): boolean {
  return routeMatchesDestination(destination, normalizePathname(pathnameWithSearch));
}

function routeMatchesDestination(destination: AppDestination, pathname: string): boolean {
  if (destination.route === pathname) {
    return true;
  }

  return destination.legacyRoutes.some(legacyRoute => {
    return pathname === legacyRoute || pathname.startsWith(`${legacyRoute}/`);
  });
}

function normalizePathname(pathnameWithSearch: string): string {
  const pathname = pathnameWithSearch.split('?')[0].split('#')[0] || '/';
  const withoutTrailingSlash = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  return withoutTrailingSlash || '/';
}
