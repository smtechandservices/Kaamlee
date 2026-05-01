from rest_framework import serializers
from .models import Transaction

class TransactionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    class Meta:
        model = Transaction
        fields = ['id', 'user', 'username', 'razorpay_order_id', 'razorpay_payment_id', 'amount', 'status', 'created_at']
