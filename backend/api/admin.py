from django.contrib import admin
from .models import Location, Job, ScrapeSession

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('city', 'state', 'country', 'country_code', 'last_scraped')
    search_fields = ('city', 'state', 'country')
    list_filter = ('country',)

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ('title', 'company', 'location', 'site', 'created_at')
    search_fields = ('title', 'company', 'location__city')
    list_filter = ('site', 'is_remote', 'date_posted')
    readonly_fields = ('created_at',)

@admin.register(ScrapeSession)
class ScrapeSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'start_time', 'end_time', 'jobs_found', 'current_location', 'stop_requested')
    list_filter = ('status', 'stop_requested')
    readonly_fields = ('start_time', 'end_time')
