from abc import ABC, abstractmethod

class BaseAdapter(ABC):
    @property
    @abstractmethod
    def platform_name(self):
        pass

    @abstractmethod
    def get_selectors(self):
        """Returns a dictionary of DOM selectors for this platform."""
        pass

    @abstractmethod
    def detect_page_type(self, url, html_content):
        """Detects if the current page is a job page, application page, etc."""
        pass

    @abstractmethod
    def extract_job_details(self, html_content):
        """Extracts job details from the page."""
        pass

    @abstractmethod
    def fill_form(self, form_data):
        """Defines logic to fill a form on this platform."""
        pass
