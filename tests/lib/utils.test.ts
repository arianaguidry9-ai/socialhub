import { cn, backoffDelay, sleep } from '@/lib/utils';

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('should resolve Tailwind conflicts', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });
});

describe('backoffDelay', () => {
  it('should increase delay exponentially', () => {
    const d0 = backoffDelay(0, 1000, 30000);
    const d1 = backoffDelay(1, 1000, 30000);
    const d2 = backoffDelay(2, 1000, 30000);

    expect(d0).toBeLessThan(d1);
    expect(d1).toBeLessThan(d2);
  });

  it('should cap at maxMs', () => {
    const d10 = backoffDelay(10, 1000, 5000);
    // Should not significantly exceed max + jitter
    expect(d10).toBeLessThanOrEqual(5500);
  });

  it('should include jitter (non-deterministic)', () => {
    const results = new Set<number>();
    for (let i = 0; i < 10; i++) {
      results.add(Math.round(backoffDelay(3, 1000)));
    }
    // With jitter, we should get variation
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('sleep', () => {
  it('should wait the specified time', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});
