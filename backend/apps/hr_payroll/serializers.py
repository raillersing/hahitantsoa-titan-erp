from rest_framework import serializers

from apps.hr_payroll.models import (
    AdvanceRequest,
    Employee,
    LeaveRequest,
    PayrollRuleSet,
    PaySlip,
)


class PayrollRuleSetSerializer(serializers.ModelSerializer):
    completeness_errors = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRuleSet
        fields = [
            "id",
            "status",
            "label",
            "effective_from",
            "effective_until",
            "source_reference",
            "validation_note",
            "irsa_brackets",
            "irsa_minimum",
            "irsa_abatement",
            "dependent_allowance",
            "contribution_base_definition",
            "cnaps_employee_rate",
            "cnaps_employer_rate",
            "ostie_employee_rate",
            "ostie_employer_rate",
            "fmfp_rate",
            "contribution_cap",
            "overtime_rules",
            "payslip_contexture",
            "dns_format",
            "ostie_format",
            "collective_agreement",
            "completeness_errors",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "completeness_errors",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]

    def get_completeness_errors(self, obj: PayrollRuleSet) -> dict[str, str]:
        return obj.configuration_errors()


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "status",
            "assignment",
            "salary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EmployeeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = [
            "id",
            "first_name",
            "last_name",
            "role",
            "status",
            "assignment",
            "salary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PaySlipSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    payroll_rule_set_label = serializers.CharField(
        source="payroll_rule_set.label", read_only=True, default=None
    )

    class Meta:
        model = PaySlip
        fields = [
            "id",
            "employee",
            "employee_name",
            "period",
            "gross_salary",
            "deductions",
            "net_salary",
            "status",
            "payroll_rule_set",
            "payroll_rule_set_label",
            "payroll_rule_snapshot",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "payroll_rule_set",
            "payroll_rule_set_label",
            "payroll_rule_snapshot",
            "created_at",
        ]

    def validate_status(self, value: str) -> str:
        if value in {"validated", "paid"}:
            instance = self.instance
            if instance is None or not instance.payroll_rule_snapshot:
                raise serializers.ValidationError(
                    "Un bulletin doit être validé par le workflow de paie pour utiliser "
                    "une règle figée."
                )
        return value


class AdvanceRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = AdvanceRequest
        fields = [
            "id",
            "employee",
            "employee_name",
            "amount",
            "reason",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "employee",
            "employee_name",
            "start_date",
            "end_date",
            "reason",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
