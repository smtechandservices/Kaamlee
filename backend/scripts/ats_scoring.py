import json
import os
import re

from django.conf import settings

ACTION_VERBS = {
    'led', 'built', 'designed', 'developed', 'implemented', 'created', 'managed',
    'launched', 'improved', 'optimized', 'reduced', 'increased', 'automated',
    'architected', 'delivered', 'drove', 'scaled', 'streamlined', 'spearheaded',
    'engineered', 'deployed', 'migrated', 'integrated', 'coordinated', 'mentored',
    'analyzed', 'resolved', 'established', 'redesigned', 'accelerated', 'owned',
}

_QUANTIFIER_RE = re.compile(r'\d')

_keywords_cache = None

def _load_profession_keywords():
    global _keywords_cache
    if _keywords_cache is None:
        path = os.path.join(settings.BASE_DIR, 'scripts', 'profession_keywords.json')
        try:
            with open(path, 'r') as f:
                _keywords_cache = json.load(f)
        except Exception:
            _keywords_cache = {}
    return _keywords_cache


def get_profession_keywords(role):
    if not role:
        return []
    return (_load_profession_keywords().get(role) or {}).get('keywords') or []


def get_all_profession_keywords():
    """role -> {"keywords": [...]} mapping for every profession we score against."""
    return _load_profession_keywords()


def _all_bullets(content):
    bullets = []
    for exp in content.get('experience') or []:
        bullets.extend(exp.get('bullets') or [])
    for proj in content.get('projects') or []:
        bullets.extend(proj.get('bullets') or [])
    return bullets


def _word_count(content):
    parts = [content.get('summary') or '']
    for exp in content.get('experience') or []:
        parts.extend(exp.get('bullets') or [])
    for proj in content.get('projects') or []:
        parts.extend(proj.get('bullets') or [])
    return len(' '.join(parts).split())


def score_cv(content, target_role=None):
    """Rule-based ATS score for a ResumeParsed-shaped dict.

    Returns (score: int 0-100, breakdown: list[{check, passed, weight, message}]).
    Weights of inapplicable checks (e.g. no target_role) are excluded from the
    denominator so the max achievable score is always 100.
    """
    content = content or {}
    checks = []

    contacts = content.get('contacts') or []
    has_email = any(c.get('type') == 'email' and c.get('value') for c in contacts)
    has_phone = any(c.get('type') == 'phone' and c.get('value') for c in contacts)
    checks.append({
        'check': 'Contact info',
        'weight': 10,
        'fraction': 1.0 if (has_email and has_phone) else (0.5 if (has_email or has_phone) else 0.0),
        'message': 'Email and phone present' if (has_email and has_phone) else 'Missing email or phone number',
    })

    summary = (content.get('summary') or '').strip()
    checks.append({
        'check': 'Summary',
        'weight': 10,
        'fraction': 1.0 if len(summary) >= 30 else (0.4 if summary else 0.0),
        'message': 'Summary present' if len(summary) >= 30 else 'Summary missing or too short',
    })

    skills = content.get('skills') or []
    has_skills = any((s.get('items') or []) for s in skills)
    checks.append({
        'check': 'Skills section',
        'weight': 10,
        'fraction': 1.0 if has_skills else 0.0,
        'message': 'Skills listed' if has_skills else 'No skills listed',
    })

    experience = content.get('experience') or []
    has_experience = any((e.get('bullets') or []) for e in experience)
    checks.append({
        'check': 'Experience section',
        'weight': 15,
        'fraction': 1.0 if has_experience else 0.0,
        'message': 'Experience with details present' if has_experience else 'No experience bullets found',
    })

    education = content.get('education') or []
    checks.append({
        'check': 'Education section',
        'weight': 5,
        'fraction': 1.0 if education else 0.0,
        'message': 'Education present' if education else 'No education entries',
    })

    bullets = _all_bullets(content)
    if bullets:
        action_verb_hits = sum(
            1 for b in bullets if b.strip().split(' ')[0].strip('.,:;').lower() in ACTION_VERBS
        )
        action_fraction = min(action_verb_hits / len(bullets) / 0.6, 1.0)
    else:
        action_fraction = 0.0
    checks.append({
        'check': 'Action verbs',
        'weight': 15,
        'fraction': action_fraction,
        'message': f'{round(action_fraction * 100)}% of the target bullet phrasing uses strong action verbs',
    })

    if bullets:
        quant_hits = sum(1 for b in bullets if _QUANTIFIER_RE.search(b))
        quant_fraction = min(quant_hits / len(bullets) / 0.3, 1.0)
    else:
        quant_fraction = 0.0
    checks.append({
        'check': 'Quantifiable results',
        'weight': 15,
        'fraction': quant_fraction,
        'message': 'Bullets include measurable results' if quant_fraction >= 1.0 else 'Add numbers/metrics to more bullets',
    })

    word_count = _word_count(content)
    if 150 <= word_count <= 1200:
        length_fraction = 1.0
    elif word_count == 0:
        length_fraction = 0.0
    else:
        length_fraction = 0.5
    checks.append({
        'check': 'Content length',
        'weight': 10,
        'fraction': length_fraction,
        'message': f'{word_count} words' + ('' if length_fraction == 1.0 else ' — outside the ideal 150-1200 word range'),
    })

    if target_role:
        keywords = get_profession_keywords(target_role)
        if keywords:
            haystack = json.dumps(content).lower()
            hits = sum(1 for k in keywords if k.lower() in haystack)
            coverage_fraction = hits / len(keywords)
            checks.append({
                'check': f'Keyword coverage for "{target_role}"',
                'weight': 10,
                'fraction': coverage_fraction,
                'message': f'{hits}/{len(keywords)} target keywords found',
            })

    total_weight = sum(c['weight'] for c in checks)
    earned = sum(c['weight'] * c['fraction'] for c in checks)
    score = round(100 * earned / total_weight) if total_weight else 0

    breakdown = [
        {
            'check': c['check'],
            'passed': c['fraction'] >= 1.0,
            'weight': c['weight'],
            'message': c['message'],
        }
        for c in checks
    ]

    return score, breakdown
