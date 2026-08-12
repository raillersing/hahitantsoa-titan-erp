from django.urls import path

from apps.hr_payroll.views import (
    AdvanceRequestListCreateAPIView,
    AdvanceRequestRetrieveUpdateDestroyAPIView,
    EmployeeListCreateAPIView,
    EmployeeRetrieveUpdateDestroyAPIView,
    LeaveRequestListCreateAPIView,
    LeaveRequestRetrieveUpdateDestroyAPIView,
    PayrollRuleSetActivateAPIView,
    PayrollRuleSetArchiveAPIView,
    PayrollRuleSetCurrentAPIView,
    PayrollRuleSetDetailAPIView,
    PayrollRuleSetListCreateAPIView,
    PayrollRuleSetSubmitAPIView,
    PaySlipListCreateAPIView,
    PaySlipRetrieveUpdateDestroyAPIView,
    PaySlipValidateAPIView,
)

urlpatterns = [
    path("rule-sets/", PayrollRuleSetListCreateAPIView.as_view(), name="hr-payroll-rule-set-list"),
    path(
        "rule-sets/current/",
        PayrollRuleSetCurrentAPIView.as_view(),
        name="hr-payroll-rule-set-current",
    ),
    path(
        "rule-sets/<uuid:pk>/",
        PayrollRuleSetDetailAPIView.as_view(),
        name="hr-payroll-rule-set-detail",
    ),
    path(
        "rule-sets/<uuid:pk>/submit/",
        PayrollRuleSetSubmitAPIView.as_view(),
        name="hr-payroll-rule-set-submit",
    ),
    path(
        "rule-sets/<uuid:pk>/activate/",
        PayrollRuleSetActivateAPIView.as_view(),
        name="hr-payroll-rule-set-activate",
    ),
    path(
        "rule-sets/<uuid:pk>/archive/",
        PayrollRuleSetArchiveAPIView.as_view(),
        name="hr-payroll-rule-set-archive",
    ),
    # Employees
    path(
        "employees/",
        EmployeeListCreateAPIView.as_view(),
        name="hr-employee-list",
    ),
    path(
        "employees/<uuid:pk>/",
        EmployeeRetrieveUpdateDestroyAPIView.as_view(),
        name="hr-employee-detail",
    ),
    # PaySlips
    path(
        "payslips/",
        PaySlipListCreateAPIView.as_view(),
        name="hr-payslip-list",
    ),
    path(
        "payslips/<uuid:pk>/",
        PaySlipRetrieveUpdateDestroyAPIView.as_view(),
        name="hr-payslip-detail",
    ),
    path(
        "payslips/<uuid:pk>/validate/",
        PaySlipValidateAPIView.as_view(),
        name="hr-payslip-validate",
    ),
    # Advance Requests
    path(
        "advances/",
        AdvanceRequestListCreateAPIView.as_view(),
        name="hr-advance-list",
    ),
    path(
        "advances/<uuid:pk>/",
        AdvanceRequestRetrieveUpdateDestroyAPIView.as_view(),
        name="hr-advance-detail",
    ),
    # Leave Requests
    path(
        "leaves/",
        LeaveRequestListCreateAPIView.as_view(),
        name="hr-leave-list",
    ),
    path(
        "leaves/<uuid:pk>/",
        LeaveRequestRetrieveUpdateDestroyAPIView.as_view(),
        name="hr-leave-detail",
    ),
]
