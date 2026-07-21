from rest_framework import serializers

from apps.hr_payroll.models import AdvanceRequest, Employee, LeaveRequest, PaySlip


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
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


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
