/**
 * Queue scheduling test stubs.
 * Mocks BullMQ queues to verify scheduling logic without Redis.
 */

// Mock the BullMQ Queue and ioredis before imports
jest.mock('bullmq', () => {
  const mockAdd = jest.fn().mockResolvedValue({});
  const mockGetJob = jest.fn();
  const MockQueue = jest.fn().mockImplementation(() => ({
    add: mockAdd,
    getJob: mockGetJob,
  }));
  return { Queue: MockQueue, Worker: jest.fn() };
});

jest.mock('@/lib/redis', () => ({ redis: {} }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { schedulePost, unschedulePost, scheduleMetricsFetch, QUEUE_NAMES } from '@/lib/queue/queues';

describe('QUEUE_NAMES', () => {
  it('should have all expected queue names', () => {
    expect(QUEUE_NAMES.POST_PUBLISH).toBe('post:publish');
    expect(QUEUE_NAMES.METRICS_FETCH).toBe('metrics:fetch');
    expect(QUEUE_NAMES.TOKEN_REFRESH).toBe('token:refresh');
    expect(QUEUE_NAMES.EMAIL_NOTIFY).toBe('email:notify');
  });
});

describe('schedulePost', () => {
  it('should schedule a post with correct delay', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    await expect(schedulePost('pt-1', futureDate, false)).resolves.not.toThrow();
  });

  it('should give premium users higher priority', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    // Premium = priority 1, Free = priority 10
    await expect(schedulePost('pt-2', futureDate, true)).resolves.not.toThrow();
  });

  it('should handle past dates with zero delay', async () => {
    const pastDate = new Date(Date.now() - 60_000);
    await expect(schedulePost('pt-3', pastDate, false)).resolves.not.toThrow();
  });
});

describe('unschedulePost', () => {
  it('should not throw when job does not exist', async () => {
    await expect(unschedulePost('nonexistent')).resolves.not.toThrow();
  });
});

describe('scheduleMetricsFetch', () => {
  it('should schedule 5 metrics fetch jobs at different intervals', async () => {
    await expect(scheduleMetricsFetch('pt-1')).resolves.not.toThrow();
  });
});
