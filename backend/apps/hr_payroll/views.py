from datetime import date

from django.core.exceptions import ValidationError
from django.db.models import Q
from django.db.models.deletion import ProtectedError
from django.http import Http404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.hr_payroll.models import (
    PAYROLL_CONFIRMABLE_FIELDS,
    AdvanceRequest,
    Employee,
    LeaveRequest,
    PayrollRuleSet,
    PaySlip,
)
from apps.hr_payroll.payroll import PaySlipValidationError, validate_payslip
from apps.hr_payroll.permissions import (
    HasPayrollRecordsEditAccess,
    HasPayrollRecordsViewAccess,
    HasPayrollRulesActivationAccess,
    HasPayrollRulesEditAccess,
    HasPayrollRulesViewAccess,
)
from apps.hr_payroll.serializers import (
    AdvanceRequestSerializer,
    EmployeeCreateSerializer,
    EmployeeSerializer,
    LeaveRequestSerializer,
    PayrollRuleSetSerializer,
    PaySlipSerializer,
)
from apps.hr_payroll.services import (
    PayrollRuleSetWorkflowError,
    activate_rule_set,
    archive_rule_set,
    confirm_rule_set_fields,
    duplicate_rule_set,
    preview_rule_set,
    submit_rule_set,
)


class PayrollRuleSetListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = PayrollRuleSetSerializer
    permission_classes = [HasPayrollRulesViewAccess]

    def get_queryset(self):
        return PayrollRuleSet.objects.select_related("created_by", "updated_by").all()

    def perform_create(self, serializer):
        if not HasPayrollRulesEditAccess().has_permission(self.request, self):
            self.permission_denied(self.request)
        serializer.save(created_by=self.request.user, updated_by=self.request.user)


class PayrollRuleSetDetailAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = PayrollRuleSetSerializer
    permission_classes = [HasPayrollRulesViewAccess]

    def get_queryset(self):
        return PayrollRuleSet.objects.select_related("created_by", "updated_by").all()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != "draft":
            return Response(
                {"detail": "Seul un brouillon peut être modifié."},
                status=status.HTTP_409_CONFLICT,
            )
        if not HasPayrollRulesEditAccess().has_permission(request, self):
            return Response(
                {"detail": HasPayrollRulesEditAccess.message},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=kwargs.get("partial", False),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        changed_fields = set(request.data).intersection(PAYROLL_CONFIRMABLE_FIELDS)
        if changed_fields:
            confirmations = dict(instance.field_confirmations or {})
            for field in changed_fields:
                metadata = dict(confirmations.get(field, {}))
                metadata["status"] = "proposed"
                metadata.pop("confirmed_at", None)
                metadata.pop("confirmed_by", None)
                confirmations[field] = metadata
            instance.field_confirmations = confirmations
            instance.save(update_fields=["field_confirmations", "updated_at"])
        return Response(serializer.data)


class PayrollRuleSetCurrentAPIView(generics.RetrieveAPIView):
    serializer_class = PayrollRuleSetSerializer
    permission_classes = [HasPayrollRulesViewAccess]

    def get_object(self):
        effective_on = self.request.query_params.get("effective_on")
        if effective_on:
            try:
                target_date = date.fromisoformat(effective_on)
            except ValueError as exc:
                raise DRFValidationError({"effective_on": "Format attendu : AAAA-MM-JJ."}) from exc
        else:
            target_date = timezone.localdate()
        rule_set = (
            PayrollRuleSet.objects.select_related("created_by", "updated_by")
            .filter(
                status="active",
                effective_from__lte=target_date,
            )
            .filter(Q(effective_until__isnull=True) | Q(effective_until__gte=target_date))
            .order_by("-effective_from", "-created_at")
            .first()
        )
        if rule_set is None:
            raise Http404("Aucune configuration active ne couvre cette date.")
        return rule_set


class PayrollRuleSetActionAPIView(APIView):
    action = None

    def post(self, request, pk):
        rule_set = PayrollRuleSet.objects.filter(pk=pk).first()
        if rule_set is None:
            return Response(
                {"detail": "Configuration introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            workflow = {
                "submit": submit_rule_set,
                "activate": activate_rule_set,
                "archive": archive_rule_set,
            }
            result = workflow[self.action](rule_set=rule_set, actor=request.user)
        except (PayrollRuleSetWorkflowError, ValidationError) as exc:
            return Response(
                {"detail": getattr(exc, "message_dict", str(exc))},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(PayrollRuleSetSerializer(result).data)


class PayrollRuleSetSubmitAPIView(PayrollRuleSetActionAPIView):
    permission_classes = [HasPayrollRulesEditAccess]
    action = "submit"


class PayrollRuleSetActivateAPIView(PayrollRuleSetActionAPIView):
    permission_classes = [HasPayrollRulesActivationAccess]
    action = "activate"


class PayrollRuleSetArchiveAPIView(PayrollRuleSetActionAPIView):
    permission_classes = [HasPayrollRulesEditAccess]
    action = "archive"


class PayrollRuleSetDuplicateAPIView(APIView):
    permission_classes = [HasPayrollRulesEditAccess]

    def post(self, request, pk):
        rule_set = PayrollRuleSet.objects.filter(pk=pk).first()
        if rule_set is None:
            return Response(
                {"detail": "Configuration introuvable."}, status=status.HTTP_404_NOT_FOUND
            )
        result = duplicate_rule_set(rule_set=rule_set, actor=request.user)
        return Response(PayrollRuleSetSerializer(result).data, status=status.HTTP_201_CREATED)


class PayrollRuleSetConfirmFieldsAPIView(APIView):
    permission_classes = [HasPayrollRulesEditAccess]

    def post(self, request, pk):
        rule_set = PayrollRuleSet.objects.filter(pk=pk).first()
        if rule_set is None:
            return Response(
                {"detail": "Configuration introuvable."}, status=status.HTTP_404_NOT_FOUND
            )
        fields = request.data.get("fields")
        if not isinstance(fields, dict) or not fields:
            return Response(
                {"detail": "Le dictionnaire fields est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = confirm_rule_set_fields(rule_set=rule_set, fields=fields, actor=request.user)
        except PayrollRuleSetWorkflowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PayrollRuleSetSerializer(result).data)


class PayrollRuleSetPreviewAPIView(APIView):
    permission_classes = [HasPayrollRulesViewAccess]

    def post(self, request, pk):
        rule_set = PayrollRuleSet.objects.filter(pk=pk).first()
        if rule_set is None:
            return Response(
                {"detail": "Configuration introuvable."}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            result = preview_rule_set(
                rule_set=rule_set, gross_salary=request.data.get("gross_salary")
            )
        except PayrollRuleSetWorkflowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)


class PaySlipValidateAPIView(APIView):
    permission_classes = [HasPayrollRulesActivationAccess]

    def post(self, request, pk):
        payslip = PaySlip.objects.filter(pk=pk).first()
        if payslip is None:
            return Response({"detail": "Bulletin introuvable."}, status=status.HTTP_404_NOT_FOUND)
        try:
            result = validate_payslip(payslip=payslip, actor=request.user)
        except (PaySlipValidationError, ValidationError) as exc:
            return Response(
                {"detail": getattr(exc, "message_dict", str(exc))},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(PaySlipSerializer(result).data)


# ── Employee ────────────────────────────────────────────────────────────────


class EmployeeListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [HasPayrollRecordsViewAccess]

    def perform_create(self, serializer):
        if not HasPayrollRecordsEditAccess().has_permission(self.request, self):
            self.permission_denied(self.request)
        serializer.save()

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
    permission_classes = [HasPayrollRecordsViewAccess]
    lookup_field = "pk"

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return EmployeeCreateSerializer
        return EmployeeSerializer

    def get_queryset(self):
        return Employee.objects.all()

    def destroy(self, request, *args, **kwargs):
        if not HasPayrollRecordsEditAccess().has_permission(request, self):
            self.permission_denied(request)
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            return Response(
                {"detail": "Cet employé possède un historique de paie protégé."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def update(self, request, *args, **kwargs):
        if not HasPayrollRecordsEditAccess().has_permission(request, self):
            self.permission_denied(request)
        return super().update(request, *args, **kwargs)


# ── PaySlip ─────────────────────────────────────────────────────────────────


class PaySlipListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [HasPayrollRecordsViewAccess]

    def perform_create(self, serializer):
        if not HasPayrollRecordsEditAccess().has_permission(self.request, self):
            self.permission_denied(self.request)
        serializer.save()

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
    permission_classes = [HasPayrollRecordsViewAccess]
    serializer_class = PaySlipSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return PaySlip.objects.select_related("employee").all()

    def update(self, request, *args, **kwargs):
        if not HasPayrollRecordsEditAccess().has_permission(request, self):
            self.permission_denied(request)
        instance = self.get_object()
        if instance.status != "draft":
            return Response(
                {"detail": "Un bulletin validé ou payé est immuable."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not HasPayrollRecordsEditAccess().has_permission(request, self):
            self.permission_denied(request)
        instance = self.get_object()
        if instance.status != "draft":
            return Response(
                {"detail": "Un bulletin validé ou payé ne peut pas être supprimé."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


# ── AdvanceRequest ──────────────────────────────────────────────────────────


class AdvanceRequestListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [HasPayrollRecordsViewAccess]

    def perform_create(self, serializer):
        if not HasPayrollRecordsEditAccess().has_permission(self.request, self):
            self.permission_denied(self.request)
        serializer.save()

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


class AdvanceRequestRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [HasPayrollRecordsViewAccess]
    serializer_class = AdvanceRequestSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return AdvanceRequest.objects.select_related("employee").all()

    def update(self, request, *args, **kwargs):
        if not HasPayrollRecordsEditAccess().has_permission(request, self):
            self.permission_denied(request)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not HasPayrollRecordsEditAccess().has_permission(request, self):
            self.permission_denied(request)
        return super().destroy(request, *args, **kwargs)


# ── LeaveRequest ────────────────────────────────────────────────────────────


class LeaveRequestListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [HasPayrollRecordsViewAccess]

    def perform_create(self, serializer):
        if not HasPayrollRecordsEditAccess().has_permission(self.request, self):
            self.permission_denied(self.request)
        serializer.save()

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


class LeaveRequestRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [HasPayrollRecordsViewAccess]
    serializer_class = LeaveRequestSerializer
    lookup_field = "pk"

    def get_queryset(self):
        return LeaveRequest.objects.select_related("employee").all()

    def update(self, request, *args, **kwargs):
        if not HasPayrollRecordsEditAccess().has_permission(request, self):
            self.permission_denied(request)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not HasPayrollRecordsEditAccess().has_permission(request, self):
            self.permission_denied(request)
        return super().destroy(request, *args, **kwargs)
