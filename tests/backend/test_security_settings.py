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


def test_static_and_media_settings_are_configured(settings) -> None:
    from pathlib import Path

    assert settings.STATIC_ROOT is not None
    assert isinstance(settings.STATIC_ROOT, Path)
    assert settings.STATIC_URL == "/static/"
    assert settings.MEDIA_ROOT is not None
    assert isinstance(settings.MEDIA_ROOT, Path)
    assert settings.MEDIA_URL == "/media/"


def test_data_upload_max_memory_size_is_at_least_15_mb(settings) -> None:
    assert settings.DATA_UPLOAD_MAX_MEMORY_SIZE >= 15 * 1024 * 1024


def test_debug_default_is_false(monkeypatch) -> None:
    from config.env import get_bool_env

    monkeypatch.delenv("DJANGO_DEBUG", raising=False)
    assert get_bool_env("DJANGO_DEBUG", default=False) is False
