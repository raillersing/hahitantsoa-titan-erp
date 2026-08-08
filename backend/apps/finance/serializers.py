from rest_framework import serializers

from .models import (
    FinanceAccount,
    FinanceAccountKind,
    FinanceBankProfile,
    FinanceBusinessScope,
)


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
    account = serializers.PrimaryKeyRelatedField(
        queryset=FinanceAccount.objects.all(), required=False
    )
    business_scope = serializers.ChoiceField(choices=FinanceBusinessScope.choices, required=False)
    account_code = serializers.CharField(max_length=64, required=False)
    account_label = serializers.CharField(max_length=255, required=False)
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

    def validate(self, attrs):
        account = attrs.get("account")
        account_fields = (
            attrs.get("business_scope"),
            attrs.get("account_code"),
            attrs.get("account_label"),
        )
        if account and any(account_fields):
            raise serializers.ValidationError(
                "Provide either an existing account or the fields required to create one, not both."
            )
        if not account and not all(account_fields):
            raise serializers.ValidationError(
                "business_scope, account_code and account_label are required for a new bank."
            )
        if not any(
            (attrs.get(field) or "").strip()
            for field in ("account_number", "rib", "iban", "swift_bic")
        ):
            raise serializers.ValidationError(
                "At least one bank identifier (account number, RIB, IBAN or BIC) is required."
            )
        return attrs


class FinanceBankProfileUpdateSerializer(serializers.Serializer):
    bank_name = serializers.CharField(max_length=255, required=False)
    account_holder = serializers.CharField(max_length=255, required=False)
    branch = serializers.CharField(max_length=255, required=False, allow_blank=True)
    account_number = serializers.CharField(max_length=128, required=False, allow_blank=True)
    rib = serializers.CharField(max_length=128, required=False, allow_blank=True)
    iban = serializers.CharField(max_length=128, required=False, allow_blank=True)
    swift_bic = serializers.CharField(max_length=32, required=False, allow_blank=True)
    is_default_for_documents = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("At least one field must be provided.")
        return attrs
