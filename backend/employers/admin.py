from django.contrib import admin
from .models import Employer, EmployerMember, KYCDocument


class EmployerMemberInline(admin.TabularInline):
    model = EmployerMember
    extra = 0


class KYCDocumentInline(admin.TabularInline):
    model = KYCDocument
    extra = 0
    readonly_fields = ('uploaded_at',)


@admin.register(Employer)
class EmployerAdmin(admin.ModelAdmin):
    list_display = ('name', 'contact_email', 'kyc_status', 'kyc_reviewed_at', 'created_at')
    list_filter = ('kyc_status',)
    search_fields = ('name', 'contact_email', 'legal_name')
    readonly_fields = ('kyc_reviewed_by', 'kyc_reviewed_at', 'created_at')
    inlines = [EmployerMemberInline, KYCDocumentInline]


@admin.register(EmployerMember)
class EmployerMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'employer', 'role', 'created_at')
    list_filter = ('role',)
    search_fields = ('user__username', 'user__email', 'employer__name')
