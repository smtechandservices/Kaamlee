from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import Job, ScrapeSession, Profile, ScrapeLog, Company

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'domain', 'is_active', 'last_scraped_at', 'created_at')
    search_fields = ('name', 'domain')
    list_filter = ('is_active',)
    readonly_fields = ('created_at',)

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ('title', 'company', 'city', 'country', 'site', 'created_at')
    search_fields = ('title', 'company', 'city')
    list_filter = ('site', 'is_remote', 'date_posted')
    readonly_fields = ('created_at',)

@admin.register(ScrapeSession)
class ScrapeSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'start_time', 'end_time', 'jobs_found', 'current_location', 'stop_requested')
    list_filter = ('status', 'stop_requested')
    readonly_fields = ('start_time', 'end_time')

@admin.register(ScrapeLog)
class ScrapeLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'session', 'level', 'message')
    list_filter = ('level', 'session')
    readonly_fields = ('timestamp',)

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = 'Profile'

class UserAdmin(BaseUserAdmin):
    inlines = (ProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'get_is_subscribed')
    
    def get_is_subscribed(self, instance):
        return instance.profile.is_subscribed
    get_is_subscribed.short_description = 'Subscribed'
    get_is_subscribed.boolean = True

admin.site.unregister(User)
admin.site.register(User, UserAdmin)

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone', 'is_subscribed', 'subscription_expires_at')
    list_filter = ('is_subscribed',)
    search_fields = ('user__username', 'phone')
