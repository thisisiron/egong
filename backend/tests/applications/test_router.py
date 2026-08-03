"""Auth guard tests for applications router. Happy-path submission is verified
manually via UI in Task 3."""

from unittest.mock import AsyncMock, MagicMock, patch

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


def _make_application_out(**overrides):
    """Factory for a default pending application (for mocking get_by_id)."""
    from src.applications.schemas import ApplicationOut
    base = {
        "id": "app-001",
        "applicant_name": "김민지",
        "applicant_email": "kim@test.com",
        "applicant_phone": "010-1234-5678",
        "academy_name": "스폰테아트미술교습소",
        "academy_region": None,
        "academy_student_count": None,
        "inquiry_message": None,
        "business_type": "individual",
        "business_name": "스폰테아트미술교습소",
        "business_owner_name": "김민지",
        "business_number": "1209862762",
        "registration_file_path": None,
        "status": "pending",
        "verified_at": None,
        "verified_b_stt_cd": None,
        "approved_at": None,
        "decided_by": None,
        "created_academy_id": None,
        "created_owner_user_id": None,
        "created_at": "2026-05-28T00:00:00+00:00",
    }
    base.update(overrides)
    return ApplicationOut(**base)


def _admin_override(user_id="admin-1"):
    """dependency_overrides callable for get_current_user → admin."""
    async def fake_user():
        return deps.CurrentUser(user_id=user_id, role="admin", academy_id=None)
    return fake_user


@pytest.mark.asyncio
async def test_approve_requires_admin(client):
    """비로그인 호출은 401."""
    response = await client.post(
        "/api/v1/admin/applications/app-001/approve"
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_approve_rejects_non_admin(client):
    """owner/teacher 등은 403."""
    from src.main import app

    async def fake_owner():
        return deps.CurrentUser(user_id="u1", role="owner", academy_id=None)

    app.dependency_overrides[deps.get_current_user] = fake_owner
    try:
        response = await client.post(
            "/api/v1/admin/applications/app-001/approve",
            headers={"Authorization": "Bearer fake"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_approve_already_approved_returns_existing(client):
    """이미 approved면 200 + already_approved=True, invite_sent=False, 같은 ID 반환."""
    from src.main import app

    app.dependency_overrides[deps.get_current_user] = _admin_override()

    approved_app = _make_application_out(
        status="approved",
        approved_at="2026-05-28T00:00:00+00:00",
        decided_by="admin-1",
        created_academy_id="acad-existing",
        created_owner_user_id="owner-existing",
    )

    try:
        with patch(
            "src.applications.service.get_by_id",
            new=AsyncMock(return_value=approved_app),
        ):
            response = await client.post(
                "/api/v1/admin/applications/app-001/approve",
                headers={"Authorization": "Bearer fake"},
            )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["academy_id"] == "acad-existing"
        assert body["owner_user_id"] == "owner-existing"
        assert body["invite_sent"] is False
        assert body["already_approved"] is True
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_approve_non_pending_returns_409(client):
    """rejected 같은 다른 상태는 409."""
    from src.main import app

    app.dependency_overrides[deps.get_current_user] = _admin_override()

    rejected_app = _make_application_out(status="rejected")

    try:
        with patch(
            "src.applications.service.get_by_id",
            new=AsyncMock(return_value=rejected_app),
        ):
            response = await client.post(
                "/api/v1/admin/applications/app-001/approve",
                headers={"Authorization": "Bearer fake"},
            )
        assert response.status_code == 409
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_approve_invite_failure_rolls_back_academy(client):
    """invite_user_by_email 실패 시 422 + academy 삭제 호출 검증."""
    from src.main import app

    app.dependency_overrides[deps.get_current_user] = _admin_override()
    pending_app = _make_application_out()

    # mock client: academies.insert 성공, auth.admin.invite_user_by_email 실패
    mock_academy_insert_resp = MagicMock(data=[{"id": "acad-new"}])

    mock_table_academies = MagicMock()
    mock_table_academies.insert.return_value.execute = AsyncMock(
        return_value=mock_academy_insert_resp
    )
    mock_table_academies.delete.return_value.eq.return_value.execute = AsyncMock(
        return_value=MagicMock(data=[])
    )

    def table_router(name):
        if name == "academy":
            return mock_table_academies
        return MagicMock()

    mock_client = MagicMock()
    mock_client.table.side_effect = table_router
    mock_client.auth.admin.invite_user_by_email = AsyncMock(
        side_effect=Exception("email already registered")
    )

    try:
        with patch(
            "src.applications.service.get_by_id",
            new=AsyncMock(return_value=pending_app),
        ), patch(
            "src.applications.service.get_admin_client",
            new=AsyncMock(return_value=mock_client),
        ), patch(
            # academy insert/delete 는 academies_service 안에서 자기 client 를
            # 생성하므로 academies 도메인의 get_admin_client 도 같은 mock 으로.
            "src.academies.service.get_admin_client",
            new=AsyncMock(return_value=mock_client),
        ):
            response = await client.post(
                "/api/v1/admin/applications/app-001/approve",
                headers={"Authorization": "Bearer fake"},
            )
        assert response.status_code == 422
        # academy 삭제(rollback)가 호출됐는지 확인 (academies_service.delete_academy 경유)
        mock_table_academies.delete.assert_called_once()
    finally:
        app.dependency_overrides.clear()
