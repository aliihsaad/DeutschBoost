import { describe, expect, it } from 'vitest';
import {
  appDestinations,
  getDestinationById,
  getDestinationByRoute,
  isDestinationActive,
} from '../../src/ui/navigationModel';

describe('navigationModel', () => {
  it('defines the experience-first desktop navigation order', () => {
    expect(appDestinations.map(destination => destination.id)).toEqual([
      'dashboard',
      'plan',
      'review',
      'practice',
      'conversation',
      'writing',
      'mistakes',
      'exam',
      'library',
      'profile',
      'settings',
    ]);
  });

  it('maps new routes to their destinations', () => {
    expect(getDestinationByRoute('/').id).toBe('dashboard');
    expect(getDestinationByRoute('/plan').id).toBe('plan');
    expect(getDestinationByRoute('/review').id).toBe('review');
    expect(getDestinationByRoute('/conversation').id).toBe('conversation');
    expect(getDestinationByRoute('/profile').id).toBe('profile');
    expect(getDestinationByRoute('/settings').id).toBe('settings');
  });

  it('maps legacy routes into the new destination model', () => {
    expect(getDestinationByRoute('/learning-plan').id).toBe('plan');
    expect(getDestinationByRoute('/activity?type=grammar').id).toBe('practice');
    expect(getDestinationByRoute('/speaking-activity').id).toBe('conversation');
    expect(getDestinationByRoute('/exam-simulator').id).toBe('exam');
  });

  it('falls back to dashboard for unknown routes', () => {
    expect(getDestinationByRoute('/something-old').id).toBe('dashboard');
  });

  it('checks active state across canonical and legacy routes', () => {
    const plan = getDestinationById('plan');
    const conversation = getDestinationById('conversation');

    expect(isDestinationActive(plan, '/plan')).toBe(true);
    expect(isDestinationActive(plan, '/learning-plan')).toBe(true);
    expect(isDestinationActive(plan, '/conversation')).toBe(false);
    expect(isDestinationActive(conversation, '/speaking-activity?topic=Ordering')).toBe(true);
  });
});
