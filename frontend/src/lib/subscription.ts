interface SubscriptionUser {
  is_subscribed: boolean;
  subscription_expires_at: string | null;
  is_superuser?: boolean;
}

// Mirrors backend/api/permissions.py's IsSubscribed check.
export function isSubscriptionActive(user: SubscriptionUser | null | undefined): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  if (!user.is_subscribed) return false;
  if (user.subscription_expires_at) {
    return new Date(user.subscription_expires_at) > new Date();
  }
  return true;
}
