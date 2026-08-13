from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.identity.permissions import HasReservationSensitiveAccess
from apps.reservations.models import ReservationDraft
from apps.notifications.models import SystemNotification
from apps.notifications.serializers import (
    PaymentReminderDispatchCreateSerializer,
    PaymentReminderDispatchSerializer,
    SystemNotificationMarkReadSerializer,
    SystemNotificationSerializer,
)
from apps.notifications.services import prepare_payment_reminder_dispatch


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
        return Response(
            PaymentReminderDispatchSerializer(dispatch).data, status=status.HTTP_201_CREATED
        )
