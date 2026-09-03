import pytest


@pytest.fixture(autouse=True)
def test_runtime_settings(settings):
    """Keep deterministic test doubles confined to the pytest runtime."""
    settings.TESTING = True
