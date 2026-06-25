import json
import os
import re
import textwrap
import urllib.error
import urllib.request
from io import BytesIO

from django.core.files.base import ContentFile
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from api.serializers import calculate_match


TEMPLATE_STYLES = {
    'modern_ats': {'title': 'Modern ATS', 'accent': '#16a34a'},
    'corporate_ats': {'title': 'Corporate ATS', 'accent': '#1e3a5f'},
}


RESUME_TAILOR_PROMPT = """You are an expert ATS resume optimizer. Analyze the candidate resume and job description carefully.

Tasks:
- Extract all required skills, tools, and keywords from the JD.
- Rewrite the professional summary to directly reference the job title, company, and top JD keywords.
- Rewrite work experience bullets to use JD keywords naturally — keep facts truthful, only rephrase.
- Rewrite each project description to highlight how it relates to the JD requirements. Explicitly mention JD-relevant skills and tools used in each project.
- Extract all skills from the resume and add any JD keywords the candidate clearly has evidence of.
- Copy education exactly as written in the resume.
- Never fabricate roles, companies, or achievements.

Return only valid JSON matching this schema exactly:
{
  "ats_score_before": number,
  "ats_score_after": number,
  "missing_skills": [],
  "optimized_resume": {
    "summary": "",
    "experience": [],
    "projects": [
      {
        "name": "",
        "description": ""
      }
    ],
    "skills": [],
    "education": []
  }
}

Rules:
- Scores must be integers 0–100. ats_score_after must be >= ats_score_before.
- experience: array of bullet strings describing truthful work history. Format: "Role at Company: bullet point."
- projects: array of objects with "name" and "description". Description must mention relevant JD skills/tools used in that project. Only include projects found in the resume.
- skills: flat array of skill strings evidenced in the resume, plus JD keywords the candidate clearly meets.
- education: copy each education entry as a single string exactly as it appears in the resume.
- missing_skills: JD requirements not evidenced anywhere in the resume.
"""


def normalize_template(template_name):
    if template_name not in TEMPLATE_STYLES:
        raise ValueError('Invalid resume template.')
    return template_name


def build_prompt(resume_text, job):
    return (
        f"{RESUME_TAILOR_PROMPT}\n\n"
        f"JOB TITLE:\n{job.title}\n\n"
        f"COMPANY:\n{job.company}\n\n"
        f"JOB DESCRIPTION:\n{job.description or ''}\n\n"
        f"CANDIDATE RESUME:\n{resume_text}\n"
    )


def call_groq_resume_tailor(resume_text, job):
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        raise RuntimeError('Groq API key is not configured.')

    payload = {
        'model': os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile'),
        'messages': [
            {
                'role': 'system',
                'content': 'You are an expert ATS resume optimizer. Return only truthful structured JSON.',
            },
            {'role': 'user', 'content': build_prompt(resume_text, job)},
        ],
        'temperature': 0.2,
        'response_format': {'type': 'json_object'},
    }
    request = urllib.request.Request(
        'https://api.groq.com/openai/v1/chat/completions',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; KaamleeATS/1.0)',
        },
        method='POST',
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='ignore')
        raise RuntimeError(f'Groq request failed: {detail or exc.reason}') from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f'Groq request failed: {exc.reason}') from exc

    content = data['choices'][0]['message']['content']
    return validate_ai_response(json.loads(content), resume_text, job)


def validate_ai_response(data, resume_text, job):
    optimized = data.get('optimized_resume') if isinstance(data, dict) else None
    if not isinstance(optimized, dict):
        raise ValueError('AI response did not include optimized_resume.')

    before = coerce_score(data.get('ats_score_before'), calculate_match(resume_text, job.title, job.description))
    after = coerce_score(data.get('ats_score_after'), min(100, before + 20))
    if after < before:
        after = before

    return {
        'ats_score_before': before,
        'ats_score_after': after,
        'missing_skills': ensure_string_list(data.get('missing_skills')),
        'optimized_resume': {
            'summary': str(optimized.get('summary') or '').strip(),
            'experience': ensure_string_list(optimized.get('experience')),
            'projects': ensure_project_list(optimized.get('projects')),
            'skills': ensure_string_list(optimized.get('skills')),
            'education': ensure_string_list(optimized.get('education')),
        },
    }


def coerce_score(value, fallback):
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        score = int(round(float(fallback or 0)))
    return max(0, min(100, score))


def ensure_string_list(value):
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        if isinstance(item, dict):
            item = ' - '.join(str(v) for v in item.values() if v)
        text = str(item).strip()
        if text:
            cleaned.append(text)
    return cleaned


def ensure_project_list(value):
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        if isinstance(item, dict):
            name = str(item.get('name') or '').strip()
            desc = str(item.get('description') or '').strip()
            if name or desc:
                cleaned.append({'name': name, 'description': desc})
        elif isinstance(item, str) and item.strip():
            cleaned.append({'name': '', 'description': item.strip()})
    return cleaned


def generate_fallback_resume(resume_text, job):
    before = calculate_match(resume_text, job.title, job.description)
    job_keywords = extract_keywords(f"{job.title} {job.description or ''}")[:18]
    candidate_keywords = extract_keywords(resume_text)[:24]
    missing = [keyword for keyword in job_keywords if keyword not in candidate_keywords][:10]
    summary_keywords = ', '.join([k.title() for k in job_keywords[:6]])
    summary = (
        f"Results-focused professional with experience aligned to {job.title} responsibilities, "
        f"including {summary_keywords}. Brings documented skills from the uploaded resume while "
        f"tailoring language for ATS relevance at {job.company}."
    )
    experience = [
        f"Applied resume-backed experience to responsibilities related to {keyword}."
        for keyword in job_keywords[:6]
    ]
    if not experience:
        experience = ['Summarized verified experience from the uploaded resume for ATS readability.']

    return {
        'ats_score_before': int(before),
        'ats_score_after': min(100, int(before) + 18),
        'missing_skills': missing,
        'optimized_resume': {
            'summary': summary,
            'experience': experience,
            'skills': [keyword.title() for keyword in candidate_keywords[:16]],
            'education': infer_education(resume_text),
        },
    }


def extract_keywords(text):
    stop_words = {
        'the', 'and', 'for', 'with', 'you', 'are', 'this', 'that', 'from', 'have', 'will',
        'your', 'our', 'job', 'role', 'work', 'team', 'years', 'experience', 'skills',
        'candidate', 'company', 'ability', 'using', 'into', 'within', 'about',
    }
    words = re.findall(r'[A-Za-z][A-Za-z0-9+#.-]{2,}', (text or '').lower())
    ordered = []
    seen = set()
    for word in words:
        if word in stop_words or word in seen:
            continue
        seen.add(word)
        ordered.append(word)
    return ordered


def infer_education(resume_text):
    lines = [line.strip() for line in (resume_text or '').splitlines() if line.strip()]
    education_terms = ('degree', 'university', 'college', 'bachelor', 'master', 'b.tech', 'mba', 'school')
    matches = [line for line in lines if any(term in line.lower() for term in education_terms)]
    return matches[:4]


def render_resume_pdf(generated_resume, user, job, template_name):
    style_config = TEMPLATE_STYLES[template_name]
    accent = colors.HexColor(style_config['accent'])
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )
    styles = getSampleStyleSheet()
    base_font = 'Times-Roman' if template_name in ('corporate_ats', 'executive_ats') else 'Helvetica'
    heading_font = 'Times-Bold' if template_name in ('corporate_ats', 'executive_ats') else 'Helvetica-Bold'
    styles.add(ParagraphStyle(name='ResumeName', fontName=heading_font, fontSize=20, leading=24, textColor=accent, spaceAfter=4))
    styles.add(ParagraphStyle(name='ResumeMeta', fontName=base_font, fontSize=8.5, leading=11, textColor=colors.HexColor('#4b5563')))
    styles.add(ParagraphStyle(name='SectionHeading', fontName=heading_font, fontSize=10.5, leading=13, textColor=accent, spaceBefore=11, spaceAfter=5))
    styles.add(ParagraphStyle(name='BodyATS', fontName=base_font, fontSize=9.2, leading=12.5, textColor=colors.HexColor('#111827')))
    styles.add(ParagraphStyle(name='BulletATS', fontName=base_font, fontSize=9, leading=12, leftIndent=10, firstLineIndent=-7))

    optimized = generated_resume['optimized_resume']
    full_name = f"{user.first_name} {user.last_name}".strip() or user.username
    story = [
        Paragraph(full_name, styles['ResumeName']),
        Paragraph(f"{user.email} | {getattr(user.profile, 'phone', '') or ''} | {getattr(user.profile, 'linkedin_url', '') or ''}", styles['ResumeMeta']),
        Spacer(1, 8),
    ]

    add_section(story, styles, 'PROFESSIONAL SUMMARY', [optimized.get('summary') or ''])
    add_section(story, styles, 'EXPERIENCE', optimized.get('experience') or [], bullet=True)
    add_section(story, styles, 'SKILLS', [', '.join(optimized.get('skills') or [])])
    add_section(story, styles, 'EDUCATION', optimized.get('education') or [], bullet=template_name == 'fresher_ats')

    score_table = Table(
        [[
            Paragraph(f"Target Role: {job.title}", styles['ResumeMeta']),
            Paragraph(f"ATS: {generated_resume['ats_score_before']} -> {generated_resume['ats_score_after']}", styles['ResumeMeta']),
        ]],
        colWidths=[4.7 * inch, 2.0 * inch],
    )
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.4, colors.HexColor('#e5e7eb')),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(Spacer(1, 10))
    story.append(score_table)

    doc.build(story)
    filename = f"ats-resume-{user.id}-{job.id}-{template_name}.pdf"
    return filename, ContentFile(buffer.getvalue())


def add_section(story, styles, heading, items, bullet=False):
    values = [item for item in items if item]
    if not values:
        return
    story.append(Paragraph(heading, styles['SectionHeading']))
    for item in values:
        text = str(item)
        chunks = textwrap.wrap(text, width=260) or [text]
        for chunk in chunks:
            prefix = '- ' if bullet else ''
            story.append(Paragraph(f"{prefix}{chunk}", styles['BulletATS' if bullet else 'BodyATS']))


def render_resume_html(generated_resume, user, job, template_name):
    import html as html_module
    optimized = generated_resume['optimized_resume']
    full_name = html_module.escape(f"{user.first_name} {user.last_name}".strip() or user.username)
    email = html_module.escape(user.email or '')
    phone = html_module.escape(getattr(user.profile, 'phone', '') or '')
    linkedin = html_module.escape(getattr(user.profile, 'linkedin_url', '') or '')
    summary = html_module.escape(optimized.get('summary') or '')
    skills_text = html_module.escape(', '.join(optimized.get('skills') or []))
    experience_html = ''.join(
        f'<li>{html_module.escape(str(item))}</li>' for item in (optimized.get('experience') or []) if item
    )
    projects_html = ''.join(
        f'<li><strong>{html_module.escape(p["name"])}</strong>'
        f'{": " + html_module.escape(p["description"]) if p.get("description") else ""}</li>'
        for p in (optimized.get('projects') or []) if p
    )
    education_html = ''.join(
        f'<li>{html_module.escape(str(item))}</li>' for item in (optimized.get('education') or []) if item
    )
    contact_parts = [email]
    if phone:
        contact_parts.append(phone)
    if linkedin:
        contact_parts.append(f'<a href="{linkedin}" style="color:inherit">{linkedin}</a>')
    contact_line = ' &nbsp;|&nbsp; '.join(contact_parts)
    ats_before = int(round(generated_resume.get('ats_score_before', 0)))
    ats_after = int(round(generated_resume.get('ats_score_after', 0)))
    job_title = html_module.escape(job.title or '')

    if template_name == 'modern_ats':
        return _html_modern(full_name, contact_line, summary, experience_html, projects_html, skills_text, education_html, ats_before, ats_after, job_title)
    return _html_corporate(full_name, contact_line, summary, experience_html, projects_html, skills_text, education_html, ats_before, ats_after, job_title)


def _html_modern(name, contact, summary, experience, projects, skills, education, ats_before, ats_after, job_title):
    projects_section = f"""
  <div class="section">
    <div class="section-title">Projects</div>
    <ul>{projects}</ul>
  </div>""" if projects else ''
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Resume &ndash; {name}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;font-size:10.5pt;line-height:1.55}}
.page{{max-width:820px;margin:0 auto;padding:44px 52px}}
.name{{font-size:26pt;font-weight:700;color:#111827;letter-spacing:-0.5px}}
.contact{{color:#6b7280;font-size:9pt;margin-top:6px}}
.contact a{{color:#16a34a;text-decoration:none}}
.divider{{border:none;border-top:2px solid #e5e7eb;margin:18px 0 0}}
.section{{margin-top:20px}}
.section-title{{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.8px;color:#16a34a;padding-bottom:4px;border-bottom:2px solid #16a34a;margin-bottom:10px}}
p{{color:#374151}}
ul{{padding-left:18px}}
ul li{{margin-bottom:6px;color:#374151}}
ul li strong{{color:#111827}}
.badge{{margin-top:32px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:7.5pt;color:#9ca3af;text-align:right}}
@media print{{body{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}}}
</style>
</head>
<body>
<div class="page">
  <div class="name">{name}</div>
  <div class="contact">{contact}</div>
  <hr class="divider">
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <p>{summary}</p>
  </div>
  <div class="section">
    <div class="section-title">Experience</div>
    <ul>{experience}</ul>
  </div>{projects_section}
  <div class="section">
    <div class="section-title">Skills</div>
    <p>{skills}</p>
  </div>
  <div class="section">
    <div class="section-title">Education</div>
    <ul>{education}</ul>
  </div>
  <div class="badge">ATS Score: {ats_before}% &rarr; {ats_after}% &nbsp;|&nbsp; Target Role: {job_title}</div>
</div>
</body>
</html>"""


def _html_corporate(name, contact, summary, experience, projects, skills, education, ats_before, ats_after, job_title):
    projects_section = f"""
    <div class="section">
      <div class="section-title">Projects</div>
      <ul>{projects}</ul>
    </div>""" if projects else ''
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Resume &ndash; {name}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Times New Roman',Times,serif;color:#1f2937;background:#fff;font-size:10.5pt;line-height:1.55}}
.page{{max-width:820px;margin:0 auto}}
.header{{background:#1e3a5f;color:#fff;padding:30px 52px 26px}}
.name{{font-size:24pt;font-weight:700;letter-spacing:0.3px}}
.contact{{font-size:9pt;color:#94a3b8;margin-top:6px}}
.contact a{{color:#93c5fd;text-decoration:none}}
.body{{padding:28px 52px 44px}}
.section{{margin-top:22px}}
.section-title{{font-size:11pt;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1.5px solid #1e3a5f;padding-bottom:3px;margin-bottom:10px}}
p{{color:#374151}}
ul{{padding-left:18px}}
ul li{{margin-bottom:6px;color:#374151}}
ul li strong{{color:#1f2937}}
.badge{{margin-top:32px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:7.5pt;color:#9ca3af;text-align:right;font-family:Arial,sans-serif}}
@media print{{body{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="name">{name}</div>
    <div class="contact">{contact}</div>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">Professional Summary</div>
      <p>{summary}</p>
    </div>
    <div class="section">
      <div class="section-title">Experience</div>
      <ul>{experience}</ul>
    </div>{projects_section}
    <div class="section">
      <div class="section-title">Skills</div>
      <p>{skills}</p>
    </div>
    <div class="section">
      <div class="section-title">Education</div>
      <ul>{education}</ul>
    </div>
    <div class="badge">ATS Score: {ats_before}% &rarr; {ats_after}% &nbsp;|&nbsp; Target Role: {job_title}</div>
  </div>
</div>
</body>
</html>"""
