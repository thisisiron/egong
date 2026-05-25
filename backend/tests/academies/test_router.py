"""Authentication and authorization tests for admin academy endpoints.

The full create flow (auth user provisioning + DB writes) is not unit-tested
here because it requires either a hermetic Supabase or extensive mocking;
it is exercised end-to-end via the admin UI manual verification step.
"""

import pytest

from src.auth import dependencies as deps

CREATE_PAYLOAD = {
    "name": "테스트학원",
    "owner_email": "owner@test.local",
    "owner_display_name": "원장",
    "owner_temp_password": "TempPass1!",
}


@pytest.mark.asyncio
async def test_create_academy_requires_auth(client):
    """No Authorization header → 401."""
    response = await client.post("/api/v1/admin/academies", json=CREATE_PAYLOAD)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_academy_rejects_non_admin(client):
    """Owner-role caller hits the admin endpoint → 403."""
    from src.main import app

    async def fake_user():
        return deps.CurrentUser(user_id="u1", role="owner", academy_id=None)

    app.dependency_overrides[deps.get_current_user] = fake_user
    try:
        response = await client.post(
            "/api/v1/admin/academies",
            json=CREATE_PAYLOAD,
            headers={"Authorization": "Bearer fake"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
