import { get } from 'svelte/store';
import { exportRefreshTrigger } from './exportNotifications';

describe('exportRefreshTrigger', () => {
  it('has initial value of 0', () => {
    expect(get(exportRefreshTrigger)).toBe(0);
  });

  it('increments correctly via update', () => {
    const initial = get(exportRefreshTrigger);
    exportRefreshTrigger.update((n) => n + 1);
    expect(get(exportRefreshTrigger)).toBe(initial + 1);
  });

  it('notifies multiple subscribers on update', () => {
    const values: number[] = [];
    const unsubscribe1 = exportRefreshTrigger.subscribe((v) => values.push(v));
    const unsubscribe2 = exportRefreshTrigger.subscribe((v) => values.push(v));

    exportRefreshTrigger.update((n) => n + 1);

    // Both subscribers should have received the new value
    const currentValue = get(exportRefreshTrigger);
    expect(values.filter((v) => v === currentValue)).toHaveLength(2);

    unsubscribe1();
    unsubscribe2();
  });
});
