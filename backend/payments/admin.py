from django.contrib import admin
from .models import Transaction

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('razorpay_order_id', 'user', 'amount', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('razorpay_order_id', 'razorpay_payment_id', 'user__username', 'user__email')
    readonly_fields = ('razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature', 'created_at')
    ordering = ('-created_at',)

    def amount_display(self, obj):
        return f"₹{obj.amount / 100}"
    amount_display.short_description = 'Amount'
