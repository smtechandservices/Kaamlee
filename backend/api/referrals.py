def attach_referral(profile, referral_code):
    """Link a newly-created candidate Profile to the ambassador whose code
    they signed up with. No-op if there's no code, it doesn't match an
    active ambassador, or the profile is already attributed (so a later
    login with a stray/stale ref code can't overwrite the original credit).
    """
    if not referral_code or profile.referred_by_id:
        return

    from ambassador.models import AmbassadorProfile

    ambassador_profile = AmbassadorProfile.objects.filter(
        referral_code__iexact=referral_code, is_active=True
    ).first()
    if not ambassador_profile or ambassador_profile.user_id == profile.user_id:
        return

    profile.referred_by = ambassador_profile
    profile.save(update_fields=['referred_by'])
