from .base import BaseAdapter

class GreenhouseAdapter(BaseAdapter):
    @property
    def platform_name(self):
        return "Greenhouse"

    def get_selectors(self):
        return {
            'apply_button': '#apply_button',
            'form_container': '#application-form',
            'submit_button': '#submit_app',
            'input_fields': 'input[type="text"], textarea',
            'dropdowns': 'select',
            'resume_upload': 'input[type="file"]',
        }

    def detect_page_type(self, url, html_content):
        if "boards.greenhouse.io" in url:
            return "job_details"
        return "unknown"

    def extract_job_details(self, html_content):
        return {}

    def fill_form(self, form_data):
        pass
