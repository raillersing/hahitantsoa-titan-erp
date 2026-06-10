from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.customers.models import Customer
from apps.customers.serializers import CustomerSerializer


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
