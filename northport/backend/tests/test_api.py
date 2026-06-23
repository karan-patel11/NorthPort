from fastapi.testclient import TestClient

from northport.backend.api.app import app


def test_health_get_and_head() -> None:
    with TestClient(app) as client:
        get_response = client.get("/health")
        head_response = client.head("/health")

    assert get_response.status_code == 200
    assert get_response.json() == {"status": "ok"}
    assert head_response.status_code == 200
    assert head_response.content == b""
