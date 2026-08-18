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
  { id: 'monthly', label: '1 Month', amount_inr: 99, amount_paise: 9900, durationLabel: '/ 1 mo' },
  { id: 'quarterly', label: '3 Months', amount_inr: 299, amount_paise: 29900, durationLabel: '/ 3 mo' },
];

export const DEFAULT_PLAN: PlanId = 'quarterly';
