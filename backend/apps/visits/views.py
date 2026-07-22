from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess
from apps.visits.models import VisitAppointment
from apps.visits.permissions import IsAuthenticatedVisitReadBoundary
from apps.visits.serializers import VisitAppointmentSerializer
from apps.visits.services import (
    VisitLifecycleError,
    cancel_visit_appointment,
    complete_visit_appointment,
    create_visit_appointment,
    update_visit_appointment,
)


def active_visit_appointments():
    return VisitAppointment.objects.select_related("customer", "responsible").order_by(
        "scheduled_at", "created_at"
    )


class VisitAppointmentListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = VisitAppointmentSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticatedVisitReadBoundary()]
        return [HasReservationSensitiveAccess()]

    @extend_schema(
        parameters=[
            OpenApiParameter("customer_id", str),
            OpenApiParameter("responsible_id", str),
            OpenApiParameter("status", str),
            OpenApiParameter("scheduled_after", str),
            OpenApiParameter("scheduled_before", str),
        ]
    )
    def get(self, request, *args, **kwargs):
        return self.list(request, *args, **kwargs)

    def get_queryset(self):
        qs = active_visit_appointments()
        for field in ("customer_id", "responsible_id", "status"):
            if value := self.request.query_params.get(field):
                qs = qs.filter(**{field: value})
        if value := self.request.query_params.get("scheduled_after"):
            qs = qs.filter(scheduled_at__gte=value)
        if value := self.request.query_params.get("scheduled_before"):
            qs = qs.filter(scheduled_at__lte=value)
        return qs

    def perform_create(self, serializer):
        serializer.instance = create_visit_appointment(
            values=serializer.validated_data,
            actor=self.request.user,
        )


class VisitAppointmentRetrieveUpdateAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = VisitAppointmentSerializer
    lookup_field = "pk"

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticatedVisitReadBoundary()]
        return [HasReservationSensitiveAccess()]

    def get_queryset(self):
        return active_visit_appointments()

    def perform_update(self, serializer):
        serializer.instance = update_visit_appointment(
            visit=self.get_object(),
            values=serializer.validated_data,
            actor=self.request.user,
        )


class VisitAppointmentTransitionAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]
    transition_service = None

    def post(self, request, pk):
        visit = get_object_or_404(active_visit_appointments(), pk=pk)
        try:
            transitioned = self.transition_service(visit=visit, actor=request.user)
        except VisitLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(VisitAppointmentSerializer(transitioned).data)


class VisitAppointmentCompleteAPIView(VisitAppointmentTransitionAPIView):
    transition_service = staticmethod(complete_visit_appointment)


class VisitAppointmentCancelAPIView(VisitAppointmentTransitionAPIView):
    transition_service = staticmethod(cancel_visit_appointment)
