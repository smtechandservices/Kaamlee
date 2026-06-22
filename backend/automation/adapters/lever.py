from .base import BaseAdapter

class LeverAdapter(BaseAdapter):
    @property
    def platform_name(self):
        return "Lever"

    def get_selectors(self):
        return {
            'apply_button': '.postings-btn',
            'form_container': '.application-form',
            'submit_button': '#application-button',
            'input_fields': 'input[type="text"], textarea',
            'dropdowns': 'select',
            'resume_upload': 'input[type="file"]',
        }

    def detect_page_type(self, url, html_content):
        if "jobs.lever.co" in url:
            return "job_details"
        return "unknown"

    def extract_job_details(self, html_content):
        return {}

    def fill_form(self, form_data):
        pass
