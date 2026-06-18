from apps.billing.apps import BillingConfig


def test_billing_app_config_name() -> None:
    assert BillingConfig.name == "apps.billing"
