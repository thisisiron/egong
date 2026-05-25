"""Auth/role guard tests for owner provisioning endpoints.

The full provisioning flow (auth user + DB writes) requires real Supabase
calls and is exercised manually via the owner UI. These tests cover the
boundary: missing token → 401, wrong role → 403.
"""

import pytest

from src.auth import dependencies as deps

TEACHER_PAYLOAD = {
    "email": "t1@test.local",
    "display_name": "김선생",
    "temp_password": "TempPass1!",
    "phone": "010-1234-5678",
}


@pytest.mark.asyncio
async def test_create_teacher_requires_auth(client):
    """No Authorization header → 401."""
    response = await client.post("/api/v1/owner/teachers", json=TEACHER_PAYLOAD)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_teacher_rejects_non_owner(client):
    """Admin-role caller hits the owner endpoint → 403."""
    from src.main import app

    async def fake_user():
        return deps.CurrentUser(user_id="u1", role="admin", academy_id=None)

    app.dependency_overrides[deps.get_current_user] = fake_user
    try:
        response = await client.post(
            "/api/v1/owner/teachers",
            json=TEACHER_PAYLOAD,
            headers={"Authorization": "Bearer fake"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_lookup_parent_requires_owner(client):
    """Teacher-role caller can't look up parents → 403."""
    from src.main import app

    async def fake_user():
        return deps.CurrentUser(user_id="u1", role="teacher", academy_id="a1")

    app.dependency_overrides[deps.get_current_user] = fake_user
    try:
        response = await client.get(
            "/api/v1/owner/parents/by-email?email=x@y.com",
            headers={"Authorization": "Bearer fake"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
