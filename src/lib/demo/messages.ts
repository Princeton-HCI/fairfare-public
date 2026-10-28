/**
 * Demo SMS message generation.
 *
 * In demo mode, we don't send real SMS messages. Instead, we generate
 * the message content client-side and display it in a fake phone UI.
 */

import { DEMO_BASE_URL } from './constants';

export interface DemoMessage {
  type: 'welcome' | 'take_rate';
  text: string;
  timestamp: string;
}

/**
 * Generates the demo SMS messages that would be sent to a real user.
 * Called client-side to avoid an unnecessary server round-trip.
 */
export const generateDemoMessages = (): DemoMessage[] => {
  const now = new Date();
  return [
    {
      type: 'welcome',
      text: "Welcome to System! We're excited to help you track your gig earnings. Your demo account is now active.",
      timestamp: now.toISOString()
    },
    {
      type: 'take_rate',
      text: `Your earnings data is ready! Check your take rate here: ${DEMO_BASE_URL}driver/data`,
      timestamp: new Date(now.getTime() + 6000).toISOString()
    }
  ];
};
