from django.urls import path

from .views import FinanceBankProfileListCreateAPIView, FinanceBankProfileUpdateAPIView

urlpatterns = [
    path("banks/", FinanceBankProfileListCreateAPIView.as_view(), name="finance-bank-list"),
    path("banks/<uuid:id>/", FinanceBankProfileUpdateAPIView.as_view(), name="finance-bank-update"),
]
