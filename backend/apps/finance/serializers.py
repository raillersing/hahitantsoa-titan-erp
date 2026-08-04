from rest_framework import serializers

from .models import FinanceAccount, FinanceAccountKind, FinanceBankProfile


class FinanceBankProfileSerializer(serializers.ModelSerializer):
    account_id = serializers.UUIDField(source="account.id", read_only=True)
    business_scope = serializers.CharField(source="account.business_scope", read_only=True)
    account_code = serializers.CharField(source="account.code", read_only=True)

    class Meta:
        model = FinanceBankProfile
        fields = (
            "id",
            "account_id",
            "business_scope",
            "account_code",
            "bank_name",
            "branch",
            "account_holder",
            "account_number",
            "rib",
            "iban",
            "swift_bic",
            "is_default_for_documents",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "account_id",
            "business_scope",
            "account_code",
            "created_at",
            "updated_at",
        )


class FinanceBankProfileCreateSerializer(serializers.Serializer):
    account = serializers.PrimaryKeyRelatedField(queryset=FinanceAccount.objects.all())
    bank_name = serializers.CharField(max_length=255)
    account_holder = serializers.CharField(max_length=255)
    branch = serializers.CharField(max_length=255, required=False, allow_blank=True)
    account_number = serializers.CharField(max_length=128, required=False, allow_blank=True)
    rib = serializers.CharField(max_length=128, required=False, allow_blank=True)
    iban = serializers.CharField(max_length=128, required=False, allow_blank=True)
    swift_bic = serializers.CharField(max_length=32, required=False, allow_blank=True)
    is_default_for_documents = serializers.BooleanField(required=False)

    def validate_account(self, account):
        if account.kind != FinanceAccountKind.BANK:
            raise serializers.ValidationError("A bank profile requires a bank finance account.")
        return account


class FinanceBankProfileUpdateSerializer(serializers.Serializer):
    bank_name = serializers.CharField(max_length=255, required=False)
    account_holder = serializers.CharField(max_length=255, required=False)
    branch = serializers.CharField(max_length=255, required=False, allow_blank=True)
    account_number = serializers.CharField(max_length=128, required=False, allow_blank=True)
    rib = serializers.CharField(max_length=128, required=False, allow_blank=True)
    iban = serializers.CharField(max_length=128, required=False, allow_blank=True)
    swift_bic = serializers.CharField(max_length=32, required=False, allow_blank=True)
    is_default_for_documents = serializers.BooleanField(required=False)
