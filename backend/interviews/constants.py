# Single source of truth for the AI interview's round structure. The frontend
# never hardcodes counts/timings — it just reads `time_limit_seconds`/`round`/
# `type` off whatever question payload the API returns.

ROUND_CONFIG = [
    {"round": "aptitude", "label": "Aptitude", "type": "mcq", "count": 5, "time_limit": 60},
    {"round": "reasoning", "label": "Reasoning", "type": "mcq", "count": 4, "time_limit": 75},
    {"round": "verbal", "label": "Verbal Ability", "type": "mcq", "count": 4, "time_limit": 45},
    {"round": "coding", "label": "Coding", "type": "open", "count": 2, "time_limit": 480},
    {"round": "hr", "label": "HR & Behavioral", "type": "open", "count": 5, "time_limit": 90},
]

ROUND_BY_NAME = {r["round"]: r for r in ROUND_CONFIG}
MAX_PROCTORING_EVENTS = 200
