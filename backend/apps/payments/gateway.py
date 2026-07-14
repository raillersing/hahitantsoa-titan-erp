from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import uuid4


class PaymentGatewayError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class GatewayInitiateResult:
    transaction_reference: str
    status: str
    raw_response: dict[str, Any]


@dataclass(frozen=True)
class GatewayStatusResult:
    status: str
    raw_response: dict[str, Any]


@dataclass(frozen=True)
class CallbackValidationResult:
    valid: bool
    transaction_reference: str
    amount: Decimal | None
    status: str
    raw_payload: dict[str, Any]


class PaymentGatewayAdapter(ABC):
    """Abstract base for payment gateway integrations."""

    @property
    @abstractmethod
    def gateway_name(self) -> str:
        """Human-readable gateway identifier."""

    @abstractmethod
    def initiate_payment(
        self,
        *,
        amount: Decimal,
        currency: str,
        description: str,
        **kwargs: Any,
    ) -> GatewayInitiateResult:
        """Initiate a payment request at the gateway and return a transaction reference."""

    @abstractmethod
    def check_status(self, transaction_reference: str) -> GatewayStatusResult:
        """Query the gateway for the current status of a transaction."""

    @abstractmethod
    def validate_callback(self, payload: dict[str, Any]) -> CallbackValidationResult:
        """Validate and extract data from an asynchronous gateway callback/webhook."""


class MockPaymentGatewayAdapter(PaymentGatewayAdapter):
    """Test-safe payment gateway that simulates immediate success.

    No external network calls. Suitable for CI and local development.
    """

    @property
    def gateway_name(self) -> str:
        return "mock"

    def initiate_payment(
        self,
        *,
        amount: Decimal,
        currency: str,
        description: str,
        **kwargs: Any,
    ) -> GatewayInitiateResult:
        ref = f"MOCK-{uuid4()}"
        return GatewayInitiateResult(
            transaction_reference=ref,
            status="pending",
            raw_response={"mock": True, "ref": ref},
        )

    def check_status(self, transaction_reference: str) -> GatewayStatusResult:
        return GatewayStatusResult(
            status="confirmed",
            raw_response={"mock": True, "ref": transaction_reference},
        )

    def validate_callback(self, payload: dict[str, Any]) -> CallbackValidationResult:
        return _validate_sandbox_callback_payload(payload)


class MVolaGatewayAdapter(PaymentGatewayAdapter):
    """Sandbox MVola adapter.

    Does not make real network calls. Simulates MVola workflow:
    - initiate returns a pending transaction reference
    - callbacks transition to confirmed/failed
    """

    @property
    def gateway_name(self) -> str:
        return "mvola_sandbox"

    def initiate_payment(
        self,
        *,
        amount: Decimal,
        currency: str,
        description: str,
        **kwargs: Any,
    ) -> GatewayInitiateResult:
        ref = f"MVOLA-SANDBOX-{uuid4()}"
        return GatewayInitiateResult(
            transaction_reference=ref,
            status="pending",
            raw_response={
                "gateway": "mvola_sandbox",
                "ref": ref,
                "amount": str(amount),
                "currency": currency,
            },
        )

    def check_status(self, transaction_reference: str) -> GatewayStatusResult:
        return GatewayStatusResult(
            status="confirmed",
            raw_response={"gateway": "mvola_sandbox", "ref": transaction_reference},
        )

    def validate_callback(self, payload: dict[str, Any]) -> CallbackValidationResult:
        return _validate_sandbox_callback_payload(payload)


def _validate_sandbox_callback_payload(
    payload: dict[str, Any],
) -> CallbackValidationResult:
    reference_value = payload.get("transaction_reference")
    reference = reference_value.strip() if isinstance(reference_value, str) else ""
    status_value = payload.get("status")
    callback_status = status_value.strip() if isinstance(status_value, str) else ""
    amount_value = payload.get("amount")
    amount: Decimal | None = None
    amount_valid = amount_value is None
    if amount_value is not None and not isinstance(amount_value, bool):
        try:
            amount = Decimal(str(amount_value))
            amount_valid = amount.is_finite() and amount > Decimal("0.00")
        except InvalidOperation, TypeError, ValueError:
            amount_valid = False

    valid_status = callback_status in {"confirmed", "failed", "cancelled"}
    valid_reference = bool(reference) and len(reference) <= 255
    confirmed_amount_valid = callback_status != "confirmed" or amount is not None
    return CallbackValidationResult(
        valid=(valid_reference and valid_status and amount_valid and confirmed_amount_valid),
        transaction_reference=reference,
        amount=amount,
        status=callback_status,
        raw_payload=payload,
    )


def get_payment_gateway_adapter(
    gateway_name: str | None = None,
) -> PaymentGatewayAdapter:
    """Return the configured payment gateway adapter.

    Default is ``MockPaymentGatewayAdapter``.
    Override via ``settings.PAYMENT_GATEWAY_ADAPTER_CLASS`` or
    ``settings.PAYMENT_GATEWAY_NAME``.
    """
    from django.conf import settings
    from django.utils.module_loading import import_string

    class_path = getattr(settings, "PAYMENT_GATEWAY_ADAPTER_CLASS", None)
    if class_path is not None:
        try:
            adapter_class = import_string(class_path)
            return adapter_class()
        except Exception as error:
            raise PaymentGatewayError(
                f"Failed to load gateway adapter class '{class_path}': {error}",
                code="gateway_adapter_load_failed",
            ) from error

    name = gateway_name or getattr(settings, "PAYMENT_GATEWAY_NAME", "mock")
    if name in {"mvola", "mvola_sandbox"}:
        return MVolaGatewayAdapter()
    if name == "mock":
        return MockPaymentGatewayAdapter()
    raise PaymentGatewayError(
        f"Unknown payment gateway: {name}",
        code="gateway_unknown",
    )
