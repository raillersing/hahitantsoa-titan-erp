def test_healthz_returns_ok(client) -> None:
    response = client.get("/healthz/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert "application/json" in response["Content-Type"]
    assert response["Cache-Control"] == "no-store"


def test_healthz_rejects_post(client) -> None:
    response = client.post("/healthz/")

    assert response.status_code == 405
