from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.identity.permissions import HasReservationSensitiveAccess
from apps.notifications.models import PaymentReminderDispatch, SystemNotification
from apps.notifications.serializers import (
    PaymentReminderDispatchCreateSerializer,
    PaymentReminderDispatchSerializer,
    SystemNotificationMarkReadSerializer,
    SystemNotificationSerializer,
)
from apps.notifications.services import (
    build_payment_reminder_for_dispatch,
    prepare_payment_reminder_dispatch,
)
from apps.reservations.models import ReservationDraft


class SystemNotificationListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    serializer_class = SystemNotificationSerializer

    def get_queryset(self):
        qs = SystemNotification.objects.filter(
            Q(recipient__isnull=True) | Q(recipient=self.request.user)
        )
        unread_only = self.request.query_params.get("unread_only")
        if unread_only == "true":
            qs = qs.filter(is_read=False)
        return qs


class SystemNotificationMarkReadAPIView(APIView):
    http_method_names = ["patch", "head", "options"]
    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        from django.shortcuts import get_object_or_404

        notification = get_object_or_404(
            SystemNotification.objects.filter(
                Q(recipient__isnull=True) | Q(recipient=request.user)
            ),
            pk=id,
        )
        serializer = SystemNotificationMarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notification.is_read = serializer.validated_data["is_read"]
        notification.save(update_fields=["is_read", "updated_at"])
        return Response(SystemNotificationSerializer(notification).data)


class SystemNotificationMarkAllReadAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        count = SystemNotification.objects.filter(
            Q(recipient__isnull=True) | Q(recipient=request.user),
            is_read=False,
        ).update(is_read=True)
        return Response({"marked_read": count}, status=status.HTTP_200_OK)


class PaymentReminderDispatchCreateAPIView(APIView):
    """Prepare an auditable reminder draft; never sends an external message."""

    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    def post(self, request):
        serializer = PaymentReminderDispatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reservation_id = serializer.validated_data.get("reservation_draft_id")
        hahitantsoa_id = serializer.validated_data.get("hahitantsoa_event_draft_id")
        if bool(reservation_id) == bool(hahitantsoa_id):
            return Response(
                {"detail": "Provide exactly one business draft.", "code": "single_draft_required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reservation = (
            ReservationDraft.objects.select_related("customer")
            .filter(id=reservation_id, is_deleted=False)
            .first()
            if reservation_id
            else None
        )
        event = (
            HahitantsoaEventDraft.objects.select_related("customer")
            .filter(id=hahitantsoa_id, is_deleted=False)
            .first()
            if hahitantsoa_id
            else None
        )
        if reservation is None and event is None:
            return Response(
                {"detail": "Business draft not found."}, status=status.HTTP_404_NOT_FOUND
            )
        dispatch = prepare_payment_reminder_dispatch(
            actor=request.user,
            reservation_draft=reservation,
            hahitantsoa_event_draft=event,
            reminder_key=serializer.validated_data["reminder_key"],
        )
        return Response(self._response_payload(dispatch), status=status.HTTP_201_CREATED)

    @staticmethod
    def _response_payload(dispatch):
        reminder = build_payment_reminder_for_dispatch(dispatch=dispatch)
        return {
            **PaymentReminderDispatchSerializer(dispatch).data,
            "reminder": {
                "business_scope": reminder.business_scope,
                "draft_id": reminder.draft_id,
                "reference": reminder.reference,
                "customer_name": reminder.customer_name,
                "customer_phone": reminder.customer_phone,
                "event_label": reminder.event_label,
                "start_at": reminder.start_at,
                "end_at": reminder.end_at,
                "confirmed_payment_count": reminder.confirmed_payment_count,
                "confirmed_amount": str(reminder.confirmed_amount),
                "refunded_amount": str(reminder.refunded_amount),
                "net_amount": str(reminder.net_amount),
                "payments": reminder.payments,
                "message": reminder.message,
                "whatsapp_url": reminder.whatsapp_url,
                "whatsapp_available": reminder.whatsapp_url is not None,
            },
        }


class PaymentReminderDispatchDetailAPIView(APIView):
    """Read one operator-prepared reminder draft for an authorized actor."""

    http_method_names = ["get", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    def get(self, request, id):
        dispatch = get_object_or_404(
            PaymentReminderDispatch.objects.select_related(
                "reservation_draft",
                "hahitantsoa_event_draft",
                "prepared_by",
            ),
            pk=id,
        )
        return Response(PaymentReminderDispatchCreateAPIView._response_payload(dispatch))
