from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.hr_payroll.models import AdvanceRequest, Employee, LeaveRequest, PaySlip
from apps.hr_payroll.serializers import (
    AdvanceRequestSerializer,
    EmployeeCreateSerializer,
    EmployeeSerializer,
    LeaveRequestSerializer,
    PaySlipSerializer,
)


# ── Employee ────────────────────────────────────────────────────────────────


class EmployeeListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmployeeCreateSerializer
        return EmployeeSerializer

    def get_queryset(self):
        qs = Employee.objects.all()
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role__icontains=role)
        assignment = self.request.query_params.get("assignment")
        if assignment:
            qs = qs.filter(assignment__icontains=assignment)
        return qs.order_by("last_name", "first_name")


class EmployeeRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return EmployeeCreateSerializer
        return EmployeeSerializer

    def get_queryset(self):
        return Employee.objects.all()


# ── PaySlip ─────────────────────────────────────────────────────────────────


class PaySlipListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return PaySlipSerializer

    def get_queryset(self):
        qs = PaySlip.objects.select_related("employee").all()
        employee = self.request.query_params.get("employee")
        if employee:
            qs = qs.filter(employee_id=employee)
        period = self.request.query_params.get("period")
        if period:
            qs = qs.filter(period=period)
        return qs.order_by("-created_at")


class PaySlipRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PaySlipSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return PaySlip.objects.select_related("employee").all()


# ── AdvanceRequest ──────────────────────────────────────────────────────────


class AdvanceRequestListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return AdvanceRequestSerializer

    def get_queryset(self):
        qs = AdvanceRequest.objects.select_related("employee").all()
        employee = self.request.query_params.get("employee")
        if employee:
            qs = qs.filter(employee_id=employee)
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        return qs.order_by("-created_at")


class AdvanceRequestRetrieveUpdateDestroyAPIView(
    generics.RetrieveUpdateDestroyAPIView
):
    permission_classes = [IsAuthenticated]
    serializer_class = AdvanceRequestSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return AdvanceRequest.objects.select_related("employee").all()


# ── LeaveRequest ────────────────────────────────────────────────────────────


class LeaveRequestListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return LeaveRequestSerializer

    def get_queryset(self):
        qs = LeaveRequest.objects.select_related("employee").all()
        employee = self.request.query_params.get("employee")
        if employee:
            qs = qs.filter(employee_id=employee)
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        return qs.order_by("-created_at")


class LeaveRequestRetrieveUpdateDestroyAPIView(
    generics.RetrieveUpdateDestroyAPIView
):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveRequestSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return LeaveRequest.objects.select_related("employee").all()
