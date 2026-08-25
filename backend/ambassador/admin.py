from django.contrib import admin
from .models import AmbassadorApplication, AmbassadorProfile

@admin.register(AmbassadorApplication)
class AmbassadorApplicationAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'college_name', 'course', 'graduation_year', 'status', 'created_at')
    list_filter = ('status', 'degree_level', 'graduation_year')
    search_fields = ('full_name', 'email', 'phone', 'college_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AmbassadorProfile)
class AmbassadorProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'referral_code', 'is_active', 'must_change_password', 'created_at')
    list_filter = ('is_active', 'must_change_password')
    search_fields = ('user__username', 'user__email', 'referral_code')
    readonly_fields = ('created_at',)
