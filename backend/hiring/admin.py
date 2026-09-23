from django.contrib import admin
from .models import JobPosting, Application, ApplicationStageChange, SavedJob, JobApplicationKit


class ApplicationInline(admin.TabularInline):
    model = Application
    extra = 0
    fields = ('candidate', 'stage', 'applied_at')
    readonly_fields = ('applied_at',)


@admin.register(JobPosting)
class JobPostingAdmin(admin.ModelAdmin):
    list_display = ('title', 'employer', 'status', 'employment_type', 'city', 'is_remote', 'created_at')
    list_filter = ('status', 'employment_type', 'is_remote', 'category')
    search_fields = ('title', 'employer__name')
    readonly_fields = ('created_at', 'updated_at', 'published_at')
    inlines = [ApplicationInline]


class StageChangeInline(admin.TabularInline):
    model = ApplicationStageChange
    extra = 0
    readonly_fields = ('from_stage', 'to_stage', 'changed_by', 'note', 'created_at')


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ('candidate', 'job_posting', 'stage', 'applied_at')
    list_filter = ('stage',)
    search_fields = ('candidate__username', 'job_posting__title')
    readonly_fields = ('applied_at', 'stage_updated_at')
    inlines = [StageChangeInline]


@admin.register(SavedJob)
class SavedJobAdmin(admin.ModelAdmin):
    list_display = ('user', 'job_posting', 'created_at')
    search_fields = ('user__username', 'job_posting__title')


@admin.register(JobApplicationKit)
class JobApplicationKitAdmin(admin.ModelAdmin):
    list_display = ('user', 'job_posting', 'created_at', 'updated_at')
    search_fields = ('user__username', 'job_posting__title')
