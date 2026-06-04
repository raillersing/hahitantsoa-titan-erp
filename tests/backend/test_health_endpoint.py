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


def test_readyz_returns_ready_when_database_and_redis_are_available(client, monkeypatch) -> None:
    monkeypatch.setattr(health_module, "is_database_ready", lambda: True)
    monkeypatch.setattr(health_module, "is_redis_ready", lambda: True)

    response = client.get("/readyz/")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "checks": {"database": "ok", "redis": "ok"},
    }
    assert "application/json" in response["Content-Type"]
    assert response["Cache-Control"] == "no-store"


def test_readyz_rejects_post(client) -> None:
    response = client.post("/readyz/")

    assert response.status_code == 405


def test_readyz_returns_not_ready_when_database_is_unavailable(client, monkeypatch) -> None:
    def broken_database_check():
        raise RuntimeError("database secret details")

    monkeypatch.setattr(health_module, "is_database_ready", broken_database_check)
    monkeypatch.setattr(health_module, "is_redis_ready", lambda: True)

    response = client.get("/readyz/")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "error", "redis": "ok"},
    }
    assert "database secret details" not in response.content.decode()
    assert response["Cache-Control"] == "no-store"


def test_readyz_returns_not_ready_when_redis_is_unavailable(client, monkeypatch) -> None:
    def broken_redis_check():
        raise RuntimeError("redis secret details")

    monkeypatch.setattr(health_module, "is_database_ready", lambda: True)
    monkeypatch.setattr(health_module, "is_redis_ready", broken_redis_check)

    response = client.get("/readyz/")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "ok", "redis": "error"},
    }
    assert "redis secret details" not in response.content.decode()
    assert response["Cache-Control"] == "no-store"


def test_readyz_returns_not_ready_when_database_and_redis_are_unavailable(
    client,
    monkeypatch,
) -> None:
    monkeypatch.setattr(health_module, "is_database_ready", lambda: False)
    monkeypatch.setattr(health_module, "is_redis_ready", lambda: False)

    response = client.get("/readyz/")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "error", "redis": "error"},
    }
    assert response["Cache-Control"] == "no-store"


def test_is_database_ready_checks_default_database(monkeypatch) -> None:
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

    assert health_module.is_database_ready() is True


def test_is_database_ready_returns_false_without_exposing_database_error(monkeypatch) -> None:
    class BrokenConnection:
        def cursor(self):
            raise RuntimeError("database secret details")

    monkeypatch.setattr(
        health_module,
        "connections",
        {"default": BrokenConnection()},
    )

    assert health_module.is_database_ready() is False


def test_is_redis_ready_authenticates_and_pings_with_resp_byte_lengths(monkeypatch) -> None:
    class WorkingRedisSocket:
        def __init__(self):
            self.commands = []
            self.responses = [b"+OK\r\n", b"+PONG\r\n"]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def settimeout(self, timeout):
            assert timeout == health_module.REDIS_READY_TIMEOUT_SECONDS

        def sendall(self, command):
            self.commands.append(command)

        def recv(self, size):
            assert size == 1024
            return self.responses.pop(0)

    redis_socket = WorkingRedisSocket()

    def create_connection(address, timeout):
        assert address == ("redis", 6379)
        assert timeout == health_module.REDIS_READY_TIMEOUT_SECONDS
        return redis_socket

    monkeypatch.setattr(health_module.settings, "REDIS_HOST", "redis")
    monkeypatch.setattr(health_module.settings, "REDIS_PORT", 6379)
    monkeypatch.setattr(health_module.settings, "REDIS_PASSWORD", "päss word")
    monkeypatch.setattr(health_module.socket, "create_connection", create_connection)

    assert health_module.is_redis_ready() is True
    assert redis_socket.commands == [
        b"*2\r\n$4\r\nAUTH\r\n$10\r\np\xc3\xa4ss word\r\n",
        b"*1\r\n$4\r\nPING\r\n",
    ]


def test_is_redis_ready_returns_false_when_ping_fails(monkeypatch) -> None:
    class BrokenRedisSocket:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def settimeout(self, timeout):
            pass

        def sendall(self, command):
            pass

        def recv(self, size):
            return b"-ERR redis secret details\r\n"

    monkeypatch.setattr(health_module.settings, "REDIS_PASSWORD", "")
    monkeypatch.setattr(
        health_module.socket,
        "create_connection",
        lambda address, timeout: BrokenRedisSocket(),
    )

    assert health_module.is_redis_ready() is False
