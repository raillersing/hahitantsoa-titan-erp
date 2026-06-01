import pytest

from config.env import get_bool_env, get_csv_env


@pytest.mark.parametrize("value", ["1", "true", "yes", "on", " TRUE ", "On"])
def test_get_bool_env_returns_true_for_truthy_values(monkeypatch, value: str) -> None:
    monkeypatch.setenv("TEST_BOOL_ENV", value)

    assert get_bool_env("TEST_BOOL_ENV") is True


@pytest.mark.parametrize("value", ["0", "false", "no", "off", " FALSE ", "Off"])
def test_get_bool_env_returns_false_for_falsey_values(monkeypatch, value: str) -> None:
    monkeypatch.setenv("TEST_BOOL_ENV", value)

    assert get_bool_env("TEST_BOOL_ENV") is False


def test_get_bool_env_uses_default_when_absent(monkeypatch) -> None:
    monkeypatch.delenv("TEST_BOOL_ENV", raising=False)

    assert get_bool_env("TEST_BOOL_ENV", default=True) is True
    assert get_bool_env("TEST_BOOL_ENV", default=False) is False


def test_get_bool_env_raises_value_error_for_invalid_value(monkeypatch) -> None:
    monkeypatch.setenv("TEST_BOOL_ENV", "invalid")

    with pytest.raises(ValueError, match="TEST_BOOL_ENV must be a boolean value"):
        get_bool_env("TEST_BOOL_ENV")


def test_get_csv_env_returns_cleaned_list(monkeypatch) -> None:
    monkeypatch.setenv("TEST_CSV_ENV", " localhost, 127.0.0.1,, example.test ")

    assert get_csv_env("TEST_CSV_ENV") == ["localhost", "127.0.0.1", "example.test"]


def test_get_csv_env_returns_empty_list_when_absent_with_empty_default(monkeypatch) -> None:
    monkeypatch.delenv("TEST_CSV_ENV", raising=False)

    assert get_csv_env("TEST_CSV_ENV") == []
