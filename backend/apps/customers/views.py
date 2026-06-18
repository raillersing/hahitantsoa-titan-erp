from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasReservationSensitiveAccess

from .models import Customer
from .serializers import CustomerSerializer


def active_customers():
    return Customer.objects.filter(is_active=True, is_deleted=False).order_by("display_name")


class CustomerListAPIView(generics.ListAPIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]
    serializer_class = CustomerSerializer

    def get_queryset(self):
        return active_customers()


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
