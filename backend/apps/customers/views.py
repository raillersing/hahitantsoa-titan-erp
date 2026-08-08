from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q
from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess

from .models import Customer, DesiredDateWaitlistEntry, DesiredDateWaitlistStatus, ProspectStatus
from .serializers import (
    CommercialTimelineEventSerializer,
    CustomerSerializer,
    DesiredDateWaitlistEntrySerializer,
)
from .services import (
    CustomerConversionError,
    DesiredDateWaitlistLifecycleError,
    ProspectTransitionError,
    convert_prospect_to_client,
    create_desired_date_waitlist_entry,
    transition_desired_date_waitlist_entry,
)


class CustomerCommercialTimelineAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: CommercialTimelineEventSerializer(many=True),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Not found."),
        },
    )
    def get(self, request, pk):
        customer = active_customers().filter(pk=pk).first()
        if customer is None:
            raise Http404("Customer not found.")
        from apps.common.commercial_timeline import get_commercial_timeline
        timeline = get_commercial_timeline(customer.id)
        serializer = CommercialTimelineEventSerializer(timeline, many=True)
        return Response(serializer.data)


def active_customers():
    return (
        Customer.objects.filter(is_active=True, is_deleted=False)
        .annotate(
            reservation_count=Count(
                "reservation_drafts",
                filter=Q(reservation_drafts__is_deleted=False),
                distinct=True,
            ),
            event_count=Count(
                "hahitantsoa_event_drafts",
                filter=Q(hahitantsoa_event_drafts__is_deleted=False),
                distinct=True,
            ),
            document_count=Count("document_instances", distinct=True),
            last_reservation_at=Max(
                "reservation_drafts__updated_at",
            ),
            last_event_at=Max("hahitantsoa_event_drafts__updated_at"),
            last_document_at=Max("document_instances__updated_at"),
        )
        .order_by("display_name")
    )


class CustomerListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerSerializer

    def get_queryset(self):
        qs = active_customers()
        name_param = self.request.query_params.get("name")
        if name_param:
            qs = qs.filter(display_name__icontains=name_param)
        email_param = self.request.query_params.get("email")
        if email_param:
            qs = qs.filter(email__icontains=email_param)
        phone_param = self.request.query_params.get("phone")
        if phone_param:
            qs = qs.filter(phone__icontains=phone_param)
        lifecycle_status = self.request.query_params.get("lifecycle_status")
        if lifecycle_status:
            qs = qs.filter(lifecycle_status=lifecycle_status)
        party_type = self.request.query_params.get("party_type")
        if party_type:
            qs = qs.filter(party_type=party_type)
        return qs


class CustomerRetrieveAPIView(generics.RetrieveAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return active_customers()


class CustomerCreateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=CustomerSerializer,
        responses={
            201: CustomerSerializer,
            400: OpenApiResponse(description="Invalid request."),
            403: OpenApiResponse(description="Unauthorized."),
        },
    )
    def post(self, request):
        serializer = CustomerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = serializer.save(created_by=request.user, updated_by=request.user)
        return Response(
            CustomerSerializer(customer).data,
            status=status.HTTP_201_CREATED,
        )


class CustomerUpdateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=CustomerSerializer,
        responses={
            200: CustomerSerializer,
            400: OpenApiResponse(description="Invalid request."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Not found."),
        },
    )
    def post(self, request, pk):
        customer = active_customers().filter(pk=pk).first()
        if customer is None:
            raise Http404("Customer not found.")

        serializer = CustomerSerializer(customer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        customer = serializer.save(updated_by=request.user)
        return Response(CustomerSerializer(customer).data, status=status.HTTP_200_OK)


class CustomerSoftDeleteAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        responses={
            200: {"type": "object", "properties": {"detail": {"type": "string"}}},
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Not found."),
        },
    )
    def post(self, request, pk):
        customer = active_customers().filter(pk=pk).first()
        if customer is None:
            raise Http404("Customer not found.")

        from django.utils import timezone

        customer.is_deleted = True
        customer.deleted_at = timezone.now()
        customer.updated_by = request.user
        customer.save(update_fields=["is_deleted", "deleted_at", "updated_at", "updated_by"])
        return Response(
            {"detail": "Customer soft-deleted."},
            status=status.HTTP_200_OK,
        )


class DesiredDateWaitlistListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = DesiredDateWaitlistEntrySerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [HasReservationSensitiveAccess()]

    def get_customer(self):
        customer = active_customers().filter(pk=self.kwargs["customer_pk"]).first()
        if customer is None:
            raise Http404("Customer not found.")
        return customer

    def get_queryset(self):
        return DesiredDateWaitlistEntry.objects.filter(customer=self.get_customer()).select_related(
            "customer", "responsible"
        )

    def perform_create(self, serializer):
        serializer.instance = create_desired_date_waitlist_entry(
            customer=self.get_customer(),
            values=serializer.validated_data,
            actor=self.request.user,
        )


class DesiredDateWaitlistRetrieveAPIView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DesiredDateWaitlistEntrySerializer
    lookup_field = "pk"

    def get_queryset(self):
        customer = active_customers().filter(pk=self.kwargs["customer_pk"]).first()
        if customer is None:
            raise Http404("Customer not found.")
        return DesiredDateWaitlistEntry.objects.filter(customer=customer).select_related(
            "customer", "responsible"
        )


class DesiredDateWaitlistTransitionAPIView(APIView):
    permission_classes = [HasReservationSensitiveAccess]
    target_status = ""

    def post(self, request, customer_pk, pk):
        customer = active_customers().filter(pk=customer_pk).first()
        if customer is None:
            raise Http404("Customer not found.")
        entry = DesiredDateWaitlistEntry.objects.filter(customer=customer, pk=pk).first()
        if entry is None:
            raise Http404("Desired-date waitlist entry not found.")
        try:
            transitioned = transition_desired_date_waitlist_entry(
                entry=entry,
                target_status=self.target_status,
                actor=request.user,
            )
        except DesiredDateWaitlistLifecycleError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(DesiredDateWaitlistEntrySerializer(transitioned).data)


class DesiredDateWaitlistContactAPIView(DesiredDateWaitlistTransitionAPIView):
    target_status = DesiredDateWaitlistStatus.CONTACTED


class DesiredDateWaitlistConvertAPIView(DesiredDateWaitlistTransitionAPIView):
    target_status = DesiredDateWaitlistStatus.CONVERTED


class DesiredDateWaitlistLoseAPIView(DesiredDateWaitlistTransitionAPIView):
    target_status = DesiredDateWaitlistStatus.LOST


class DesiredDateWaitlistCancelAPIView(DesiredDateWaitlistTransitionAPIView):
    target_status = DesiredDateWaitlistStatus.CANCELLED


class CustomerConvertAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        responses={
            200: CustomerSerializer,
            400: OpenApiResponse(description="Customer is not a prospect."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Not found."),
        },
    )
    def post(self, request, pk):
        customer = active_customers().filter(pk=pk).first()
        if customer is None:
            raise Http404("Customer not found.")
        try:
            converted = convert_prospect_to_client(customer=customer, actor=request.user)
        except CustomerConversionError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(CustomerSerializer(converted).data, status=status.HTTP_200_OK)


class ProspectStatusTransitionPayloadSerializer(serializers.Serializer):
    prospect_status = serializers.ChoiceField(
        choices=ProspectStatus.choices,
        required=True,
    )
    reason = serializers.CharField(required=False, allow_blank=True)
    next_follow_up = serializers.DateField(required=False, allow_null=True)
    follow_up_owner_id = serializers.UUIDField(required=False, allow_null=True)


class ProspectStatusTransitionAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [HasReservationSensitiveAccess]

    @extend_schema(
        request=ProspectStatusTransitionPayloadSerializer,
        responses={
            200: CustomerSerializer,
            400: OpenApiResponse(description="Invalid transition or missing reason."),
            403: OpenApiResponse(description="Unauthorized."),
            404: OpenApiResponse(description="Not found."),
        },
    )
    def post(self, request, pk):
        customer = active_customers().filter(pk=pk).first()
        if customer is None:
            raise Http404("Customer not found.")

        payload = ProspectStatusTransitionPayloadSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        target_status = payload.validated_data["prospect_status"]
        reason = payload.validated_data.get("reason", "")
        next_follow_up = payload.validated_data.get("next_follow_up")
        follow_up_owner_id = payload.validated_data.get("follow_up_owner_id")

        follow_up_owner = None
        if follow_up_owner_id:
            User = get_user_model()
            follow_up_owner = User.objects.filter(pk=follow_up_owner_id).first()

        try:
            from .services import transition_prospect_status

            transitioned = transition_prospect_status(
                customer=customer,
                target_status=target_status,
                actor=request.user,
                reason=reason,
                follow_up_owner=follow_up_owner,
            )
            if next_follow_up is not None:
                transitioned.prospect_next_follow_up = next_follow_up
                transitioned.save(update_fields=["prospect_next_follow_up", "updated_at"])
        except ProspectTransitionError as error:
            return Response(
                {"detail": str(error), "code": error.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(CustomerSerializer(transitioned).data, status=status.HTTP_200_OK)
