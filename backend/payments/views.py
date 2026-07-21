import os
import logging
import razorpay
import json
from datetime import timedelta
from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework import views, viewsets, permissions
from rest_framework.response import Response
from .models import Transaction
from .serializers import TransactionSerializer
from django.contrib.auth.models import User
from django.conf import settings
from api.models import Profile
from django.db.models import Sum
from .constants import SUBSCRIPTION_PRICE_PAISE, SUBSCRIPTION_PRICE_INR

logger = logging.getLogger(__name__)

class CreateOrderView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # amount = request.data.get('amount') # in paise
        # amount = SUBSCRIPTION_PRICE_PAISE # Production price: 99 INR (9900 paise), see payments/constants.py
        amount = 100 # testing price: 1 INR (100 paise)

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)

        if not key_id or not key_secret:
            logger.error("Razorpay keys are missing in settings")
            return Response({"error": "Razorpay keys are not configured"}, status=500)

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
        except Exception:
            logger.exception("Failed to create Razorpay order for user %s", request.user.id)
            return Response({"error": "Could not create order. Please try again."}, status=500)

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

        from api.serializers import UserSerializer

        # verify_payment_signature is a local HMAC check (no network call), so it's
        # safe to do inside the locked section below alongside the row locks.
        with db_transaction.atomic():
            # select_for_update locks the transaction + profile rows so a concurrent
            # replay of the same (order_id, payment_id, signature) can't race past
            # the status check below and extend the subscription twice.
            transaction = Transaction.objects.select_for_update().filter(
                razorpay_order_id=razorpay_order_id, user=request.user
            ).first()
            if not transaction:
                return Response({"error": "Transaction not found"}, status=404)

            # Idempotent: a replayed/duplicate call for an already-credited transaction
            # must not extend the subscription again.
            if transaction.status == 'success':
                return Response({"status": "success", "user": UserSerializer(request.user).data})

            try:
                client.utility.verify_payment_signature(params_dict)
            except razorpay.errors.SignatureVerificationError:
                # The signature itself didn't check out — this genuinely wasn't a
                # valid payment, so it's correct to mark the transaction failed.
                transaction.status = 'failed'
                transaction.save()
                return Response({"error": "Invalid signature or payment failed"}, status=400)

            # From here on the payment is verified as real. Any failure below is our
            # own bug, not a bad payment — don't mark the transaction 'failed' (that
            # would tell a user who was actually charged that their payment failed).
            # Leave it as-is so CheckPaymentStatusView can reconcile it later.
            try:
                profile = Profile.objects.select_for_update().get(user=request.user)
                now = timezone.now()

                if profile.subscription_expires_at and profile.subscription_expires_at > now:
                    profile.subscription_expires_at += timedelta(days=30)
                else:
                    profile.subscription_expires_at = now + timedelta(days=30)

                profile.is_subscribed = True
                profile.save()

                transaction.razorpay_payment_id = razorpay_payment_id
                transaction.razorpay_signature = razorpay_signature
                transaction.status = 'success'
                transaction.save()

                return Response({"status": "success", "user": UserSerializer(request.user).data})
            except Exception:
                logger.exception(
                    "Verified payment for order %s could not be applied to user %s",
                    razorpay_order_id, request.user.id,
                )
                return Response(
                    {"error": "Payment verified but activation failed. Please contact support."},
                    status=500,
                )

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

            if not Transaction.objects.filter(razorpay_order_id=order_id, user=request.user).exists():
                return Response({"error": "Transaction not found"}, status=404)

            if successful_payment:
                # Row locks held only for the DB update below, not the Razorpay call above.
                with db_transaction.atomic():
                    transaction = Transaction.objects.select_for_update().filter(
                        razorpay_order_id=order_id, user=request.user
                    ).first()
                    if not transaction:
                        return Response({"error": "Transaction not found"}, status=404)

                    if transaction.status != 'success':
                        transaction.status = 'success'
                        transaction.razorpay_payment_id = successful_payment['id']
                        transaction.save()

                        profile = Profile.objects.select_for_update().get(user=transaction.user)
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
        except Exception:
            logger.exception("Failed to check payment status for order %s", order_id)
            return Response({"error": "Could not check payment status. Please try again."}, status=500)

class AdminRevenueStatsView(views.APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # 1. Revenue (converting paise to INR)
        total_revenue = Transaction.objects.filter(status='success').aggregate(Sum('amount'))['amount__sum'] or 0
        monthly_revenue = Transaction.objects.filter(status='success', created_at__gte=start_of_month).aggregate(Sum('amount'))['amount__sum'] or 0
        
        # 2. Subscribed Users
        active_subscriptions = Profile.objects.filter(is_subscribed=True, subscription_expires_at__gt=now).count()
        total_users = Profile.objects.count()
        
        # 3. Recent Transactions (Returning all to allow filtering)
        recent_transactions = Transaction.objects.all().order_by('-created_at')[:100]
        serializer = TransactionSerializer(recent_transactions, many=True)
        
        return Response({
            'total_revenue': total_revenue / 100,
            'monthly_revenue': monthly_revenue / 100,
            'active_subscriptions': active_subscriptions,
            'total_users': total_users,
            'recent_transactions': serializer.data
        })
