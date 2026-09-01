import pytest

from config.env import get_int_env


def test_security_headers_have_safe_baseline(settings) -> None:
    assert settings.SECURE_CONTENT_TYPE_NOSNIFF is True
    assert settings.SECURE_REFERRER_POLICY == "same-origin"
    assert settings.X_FRAME_OPTIONS == "DENY"


def test_proxy_headers_are_disabled_without_explicit_trust(settings) -> None:
    assert settings.SECURE_PROXY_SSL_HEADER is None


def test_get_int_env_uses_default_when_value_is_missing(monkeypatch) -> None:
    monkeypatch.delenv("DJANGO_SECURE_HSTS_SECONDS", raising=False)

    assert get_int_env("DJANGO_SECURE_HSTS_SECONDS", default=31536000) == 31536000


def test_get_int_env_rejects_invalid_values(monkeypatch) -> None:
    monkeypatch.setenv("DJANGO_SECURE_HSTS_SECONDS", "not-a-number")

    with pytest.raises(ValueError, match="DJANGO_SECURE_HSTS_SECONDS must be an integer value"):
        get_int_env("DJANGO_SECURE_HSTS_SECONDS")
