from apps.identity.apps import IdentityConfig


def test_identity_app_config_name() -> None:
    assert IdentityConfig.name == "apps.identity"
