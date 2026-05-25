import pytest

from src.auth import dependencies as deps


@pytest.mark.asyncio
async def test_impersonate_requires_auth(client):
    response = await client.post("/api/v1/admin/impersonate", json={"academy_id": "x"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_impersonate_rejects_non_admin(client):
    from src.main import app

    async def fake_user():
        return deps.CurrentUser(user_id="u1", role="owner", academy_id=None)

    app.dependency_overrides[deps.get_current_user] = fake_user
    try:
        response = await client.post(
            "/api/v1/admin/impersonate",
            json={"academy_id": "x"},
            headers={"Authorization": "Bearer fake"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
