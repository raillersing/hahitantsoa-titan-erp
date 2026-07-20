from django.urls import path

from apps.hr_payroll.views import (
    AdvanceRequestListCreateAPIView,
    AdvanceRequestRetrieveUpdateDestroyAPIView,
    EmployeeListCreateAPIView,
    EmployeeRetrieveUpdateDestroyAPIView,
    LeaveRequestListCreateAPIView,
    LeaveRequestRetrieveUpdateDestroyAPIView,
    PaySlipListCreateAPIView,
    PaySlipRetrieveUpdateDestroyAPIView,
)

urlpatterns = [
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
