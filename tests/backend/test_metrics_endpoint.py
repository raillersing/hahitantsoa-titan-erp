import platform

import django
import pytest

import config.metrics as metrics_module

pytestmark = pytest.mark.django_db


def test_metrics_returns_expected_keys(client) -> None:
    response = client.get("/metrics/")

    assert response.status_code == 200
    data = response.json()
    assert data["app_version"] == "0.1.0"
    assert data["django_version"] == django.get_version()
    assert data["python_version"] == platform.python_version()
    assert isinstance(data["debug"], bool)
    assert isinstance(data["uptime_seconds"], int)
    assert data["uptime_seconds"] >= 0
    assert isinstance(data["allowed_hosts_count"], int)
    assert isinstance(data["installed_apps_count"], int)
    assert isinstance(data["database_ready"], bool)
    assert isinstance(data["redis_ready"], bool)
    assert "application/json" in response["Content-Type"]
    assert response["Cache-Control"] == "no-store"


def test_metrics_rejects_post(client) -> None:
    response = client.post("/metrics/")
    assert response.status_code == 405


def test_metrics_uptime_increases(client, monkeypatch) -> None:
    monkeypatch.setattr(metrics_module, "_UPTIME_ANCHOR", 0.0)
    response1 = client.get("/metrics/")
    uptime1 = response1.json()["uptime_seconds"]

    response2 = client.get("/metrics/")
    uptime2 = response2.json()["uptime_seconds"]

    assert uptime2 >= uptime1


def test_metrics_database_ready_false_when_database_broken(client, monkeypatch) -> None:
    monkeypatch.setattr(metrics_module, "is_database_ready", lambda: False)
    response = client.get("/metrics/")
    assert response.json()["database_ready"] is False


def test_metrics_redis_ready_false_when_redis_broken(client, monkeypatch) -> None:
    monkeypatch.setattr(metrics_module, "is_redis_ready", lambda: False)
    response = client.get("/metrics/")
    assert response.json()["redis_ready"] is False
