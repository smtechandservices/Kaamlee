import os
import razorpay
import json
from datetime import timedelta
from django.utils import timezone
from rest_framework import views, viewsets, permissions
from rest_framework.response import Response
from .models import Transaction
from .serializers import TransactionSerializer
from django.contrib.auth.models import User
from django.conf import settings

class CreateOrderView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # amount = request.data.get('amount') # in paise
        amount = 24900 # Production price: 249 INR (24900 paise)

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)

        if not key_id or not key_secret:
            print("DEBUG: Razorpay keys are MISSING in settings")
            return Response({"error": "Razorpay keys are not configured"}, status=500)

        # Log masked keys for debugging
        masked_id = f"{key_id[:8]}...{key_id[-4:]}" if key_id else "None"
        print(f"DEBUG: Initializing Razorpay with Key ID: {masked_id}")

        client = razorpay.Client(auth=(key_id, key_secret))

        
        try:
            order_data = {
                'amount': int(amount),
                'currency': 'INR',
                'receipt': f'receipt_{request.user.id}_{int(timezone.now().timestamp())}',
                'notes': {
                    'portal': f'kaamlee | {request.user.username}'
                },
                'payment_capture': 1
            }
            order = client.order.create(data=order_data)
            
            # Save pending transaction
            Transaction.objects.create(
                user=request.user,
                razorpay_order_id=order['id'],
                amount=amount,
                status='pending'
            )
            
            return Response({
                'order_id': order['id'],
                'amount': order['amount'],
                'currency': order['currency']
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class VerifyPaymentView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_signature = request.data.get('razorpay_signature')

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
        client = razorpay.Client(auth=(key_id, key_secret))

        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }

        try:
            client.utility.verify_payment_signature(params_dict)
            
            # Payment successful, update user subscription
            profile = request.user.profile
            now = timezone.now()
            
            if profile.subscription_expires_at and profile.subscription_expires_at > now:
                profile.subscription_expires_at += timedelta(days=30)
            else:
                profile.subscription_expires_at = now + timedelta(days=30)
            
            profile.is_subscribed = True
            profile.save()
            
            # Update transaction
            transaction = Transaction.objects.filter(razorpay_order_id=razorpay_order_id).first()
            if transaction:
                transaction.razorpay_payment_id = razorpay_payment_id
                transaction.razorpay_signature = razorpay_signature
                transaction.status = 'success'
                transaction.save()
            
            from api.serializers import UserSerializer
            return Response({"status": "success", "user": UserSerializer(request.user).data})
        except Exception as e:
            # Update transaction as failed
            transaction = Transaction.objects.filter(razorpay_order_id=razorpay_order_id).first()
            if transaction:
                transaction.status = 'failed'
                transaction.save()
            return Response({"error": "Invalid signature or payment failed"}, status=400)

class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff:
            queryset = Transaction.objects.all()
            user_id = self.request.query_params.get('user_id')
            if user_id:
                queryset = queryset.filter(user_id=user_id)
            return queryset.order_by('-created_at')
        return Transaction.objects.filter(user=self.request.user).order_by('-created_at')


class CheckPaymentStatusView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order_id = request.data.get('razorpay_order_id')
        if not order_id:
            return Response({"error": "Order ID is required"}, status=400)

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
        client = razorpay.Client(auth=(key_id, key_secret))
        
        try:
            # Fetch payments for this order from Razorpay
            payments = client.order.payments(order_id)
            
            # Check if any payment is 'captured'
            successful_payment = next((p for p in payments['items'] if p['status'] == 'captured'), None)
            
            transaction = Transaction.objects.filter(razorpay_order_id=order_id).first()
            if not transaction:
                return Response({"error": "Transaction not found"}, status=404)

            if successful_payment:
                # Update transaction and user profile
                if transaction.status != 'success':
                    transaction.status = 'success'
                    transaction.razorpay_payment_id = successful_payment['id']
                    transaction.save()
                    
                    profile = transaction.user.profile
                    now = timezone.now()
                    if profile.subscription_expires_at and profile.subscription_expires_at > now:
                        profile.subscription_expires_at += timedelta(days=30)
                    else:
                        profile.subscription_expires_at = now + timedelta(days=30)
                    profile.is_subscribed = True
                    profile.save()
                
                return Response({
                    "status": "success", 
                    "message": "Payment verified via Razorpay API",
                    "payment_id": successful_payment['id']
                })
            else:
                # If no successful payment, but we have items, it might be failed or still pending
                status = "pending"
                if any(p['status'] == 'failed' for p in payments['items']):
                    status = "failed"
                
                return Response({
                    "status": status,
                    "message": f"No captured payment found. Current status: {status}"
                })
        except Exception as e:
            return Response({"error": str(e)}, status=500)
