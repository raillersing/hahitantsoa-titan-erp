from django.apps import apps


def test_common_app_is_installed() -> None:
    assert apps.is_installed("apps.common")


def test_common_app_config_name() -> None:
    common_config = apps.get_app_config("common")

    assert common_config.name == "apps.common"


def test_common_app_config_verbose_name() -> None:
    common_config = apps.get_app_config("common")

    assert common_config.verbose_name == "Common"
