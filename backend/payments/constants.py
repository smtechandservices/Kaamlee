# Subscription Pricing Constants
# All prices are in INR unless specified otherwise.

PLANS = {
    'monthly': {
        'label': '1 Month',
        'amount_inr': 99,
        'amount_paise': 9900,
        'duration_days': 30,
    },
    'quarterly': {
        'label': '3 Months',
        'amount_inr': 249,
        'amount_paise': 24900,
        'duration_days': 90,
    },
}

DEFAULT_PLAN = 'quarterly'
