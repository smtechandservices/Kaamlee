from django.contrib import admin
from .models import Event, EventRegistration


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_by_ambassador', 'event_date', 'status', 'price_paise')
    list_filter = ('status',)
    search_fields = ('title', 'location')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(EventRegistration)
class EventRegistrationAdmin(admin.ModelAdmin):
    list_display = ('event', 'user', 'status', 'amount_paise', 'created_at')
    list_filter = ('status',)
    search_fields = ('user__username', 'user__email', 'event__title')
