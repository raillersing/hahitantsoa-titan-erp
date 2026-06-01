import config.health as health_module


def test_healthz_returns_ok(client) -> None:
    response = client.get("/healthz/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert "application/json" in response["Content-Type"]
    assert response["Cache-Control"] == "no-store"


def test_healthz_rejects_post(client) -> None:
    response = client.post("/healthz/")

    assert response.status_code == 405


def test_readyz_returns_ready_when_database_is_available(client, monkeypatch) -> None:
    class WorkingCursor:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def execute(self, query):
            assert query == "SELECT 1"

        def fetchone(self):
            return (1,)

    class WorkingConnection:
        def cursor(self):
            return WorkingCursor()

    monkeypatch.setattr(
        health_module,
        "connections",
        {"default": WorkingConnection()},
    )

    response = client.get("/readyz/")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "checks": {"database": "ok"}}
    assert "application/json" in response["Content-Type"]
    assert response["Cache-Control"] == "no-store"


def test_readyz_rejects_post(client) -> None:
    response = client.post("/readyz/")

    assert response.status_code == 405


def test_readyz_returns_not_ready_without_exposing_database_error(client, monkeypatch) -> None:
    class BrokenConnection:
        def cursor(self):
            raise RuntimeError("database secret details")

    monkeypatch.setattr(
        health_module,
        "connections",
        {"default": BrokenConnection()},
    )

    response = client.get("/readyz/")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready", "checks": {"database": "error"}}
    assert "database secret details" not in response.content.decode()
    assert response["Cache-Control"] == "no-store"
