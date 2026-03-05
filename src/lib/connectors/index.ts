import type { Platform } from '@/types';
import type { BasePlatformConnector } from './base';
import { RedditConnector } from './reddit';
import { TwitterConnector } from './twitter';
import { LinkedInConnector } from './linkedin';
import { InstagramConnector } from './instagram';

const connectors: Record<string, BasePlatformConnector> = {
  reddit: new RedditConnector(),
  twitter: new TwitterConnector(),
  linkedin: new LinkedInConnector(),
  instagram: new InstagramConnector(),
};

/** Get the platform connector instance for a given platform. */
export function getConnector(platform: Platform | string): BasePlatformConnector {
  const key = platform.toLowerCase();
  const connector = connectors[key];
  if (!connector) {
    throw new Error(`No connector implemented for platform: ${platform}`);
  }
  return connector;
}

export { RedditConnector } from './reddit';
export { TwitterConnector } from './twitter';
export { LinkedInConnector } from './linkedin';
export { InstagramConnector } from './instagram';
export type { BasePlatformConnector, PublishResult, PlatformProfile } from './base';
export { PlatformApiError } from './base';
