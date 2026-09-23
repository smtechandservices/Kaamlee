/**
 * Subscription Pricing Constants
 */
export type PlanId = 'monthly' | 'quarterly';

export interface Plan {
  id: PlanId;
  label: string;
  amount_inr: number;
  amount_paise: number;
  durationLabel: string;
  badge?: string;
}

export const PLANS: Plan[] = [
  { id: 'monthly', label: '1 Month', amount_inr: 49, amount_paise: 4900, durationLabel: '/ 1 mo' },
  { id: 'quarterly', label: '3 Months', amount_inr: 139, amount_paise: 13900, durationLabel: '/ 3 mo' },
];

export const DEFAULT_PLAN: PlanId = 'quarterly';

// Where candidates go for help — the sidebar's support card and the landing
// page's floating WhatsApp button both use these.
export const SUPPORT_EMAIL = 'kaamlee2026@gmail.com';
export const COMMUNITY_URL = 'https://chat.whatsapp.com/HtJ3XG4RgwAAZiYYN79rOb?s=cl&p=i&ilr=0';
