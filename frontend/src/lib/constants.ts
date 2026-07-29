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
  { id: 'quarterly', label: '3 Months', amount_inr: 99, amount_paise: 9900, durationLabel: '/ 3 mo', badge: 'Best Value' },
];

export const DEFAULT_PLAN: PlanId = 'quarterly';

// Future plans (post-beta) will start from ₹299/mo once premium features launch.
export const FUTURE_PRICING_FROM_INR = 299;
