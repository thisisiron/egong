"""Auth guard tests for applications router. Happy-path submission is verified
manually via UI in Task 3."""

import pytest

from src.auth import dependencies as deps


@pytest.mark.asyncio
async def test_public_submit_endpoint_does_not_require_auth(client):
    """POST /applications should NOT 401 — payload validation will reject empty body."""
    response = await client.post("/api/v1/applications", json={})
    # 422 (validation error) — auth not hit. 401 means auth incorrectly required.
    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_list_applications_requires_admin(client):
    response = await client.get("/api/v1/admin/applications")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_applications_rejects_non_admin(client):
    from src.main import app

    async def fake_user():
        return deps.CurrentUser(user_id="u1", role="owner", academy_id=None)

    app.dependency_overrides[deps.get_current_user] = fake_user
    try:
        response = await client.get(
            "/api/v1/admin/applications",
            headers={"Authorization": "Bearer fake"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_application_requires_admin(client):
    response = await client.get("/api/v1/admin/applications/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 401
