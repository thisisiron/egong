"""Academy application domain logic.

- submit: public (no auth, called via router)
- list/get_by_id: admin only
- signed_download_url: admin only — generate signed URL for business doc download

All Supabase calls use the service-role client (bypasses RLS for our trusted ops).
The anon-facing surface is enforced by the router's dependency-less endpoint
and by table/storage RLS at the DB layer.
"""

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status

from src.audit import service as audit_log
from src.common.supabase_admin import get_admin_client

from .schemas import ApplicationOut, ApplicationSubmit, ApprovalResult, SignedDownloadUrl

logger = logging.getLogger(__name__)


async def submit(payload: ApplicationSubmit) -> None:
    """Insert a new pending application. No auth required."""
    client = await get_admin_client()
    try:
        # 진위확인 코드가 있으면 verified_at = now(), 둘 다 set.
        # CHECK 제약(둘 다 NULL 이거나 둘 다 SET)을 만족시키기 위해 한 묶음으로.
        verified_at: str | None = None
        if payload.verified_b_stt_cd:
            verified_at = datetime.now(timezone.utc).isoformat()

        await client.table("academy_applications").insert(
            {
                "applicant_name": payload.applicant_name,
                "applicant_email": payload.applicant_email,
                "applicant_phone": payload.applicant_phone,
                "academy_name": payload.academy_name,
                "academy_region": payload.academy_region,
                "academy_student_count": payload.academy_student_count,
                "inquiry_message": payload.inquiry_message,
                "business_type": payload.business_type,
                "business_name": payload.business_name,
                "business_owner_name": payload.business_owner_name,
                "business_number": payload.business_number,
                "registration_file_path": payload.registration_file_path,
                "verified_at": verified_at,
                "verified_b_stt_cd": payload.verified_b_stt_cd,
            }
        ).execute()
    except Exception:
        # Never leak driver-level details to anon callers.
        logger.exception("application submit failed (email=%s)", payload.applicant_email)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "failed to submit application",
        ) from None


async def list_all() -> list[ApplicationOut]:
    """Admin-only: list applications, newest first."""
    client = await get_admin_client()
    resp = await (
        client.table("academy_applications")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return [_to_out(row) for row in (resp.data or [])]


async def get_by_id(application_id: str) -> ApplicationOut:
    """Admin-only: fetch one application."""
    client = await get_admin_client()
    resp = await (
        client.table("academy_applications")
        .select("*")
        .eq("id", application_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "application not found")
    return _to_out(resp.data)


async def signed_download_url(
    application_id: str, expires_in: int = 300
) -> SignedDownloadUrl | None:
    """Admin-only: signed URL to download a registration file (or None if none uploaded)."""
    app = await get_by_id(application_id)
    if not app.registration_file_path:
        return None
    client = await get_admin_client()
    resp = await client.storage.from_("business-docs").create_signed_url(
        app.registration_file_path, expires_in
    )
    # supabase-py returns dict-like; key name varies by version (signedURL vs signed_url).
    url = _extract_signed_url(resp)
    if not url:
        logger.error("create_signed_url returned no URL field: %r", resp)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "failed to create signed url"
        )
    return SignedDownloadUrl(url=url, expires_in=expires_in)


def _extract_signed_url(resp: object) -> str | None:
    """Pull URL from a supabase-py storage response across version key-name variations."""
    for key in ("signedURL", "signed_url", "signedUrl"):
        if isinstance(resp, dict):
            value = resp.get(key)
        else:
            value = getattr(resp, key, None)
        if isinstance(value, str) and value:
            return value
    return None


def _to_out(row: dict) -> ApplicationOut:
    return ApplicationOut(**row)


async def approve(application_id: str, admin_user_id: str) -> ApprovalResult:
    """승인: 학원 생성 + 원장 초대 + 신청 상태 업데이트. 중복 호출 안전.

    중복 호출 안전성:
    - 이미 approved 상태인 신청에 재호출 시 → 기존 academy/owner ID 반환,
      invite_sent=False, already_approved=True. 메일 재발송 X.
    - rejected/canceled 등 다른 상태는 409.

    부분 실패 보상 트랜잭션:
    - academy 생성 후 invite 실패 → academy 삭제
    - invite 후 users insert 실패 → auth user 삭제 + academy 삭제
    - users 후 owners insert 실패 → users 삭제 + auth user 삭제 + academy 삭제
    - cleanup 자체가 실패하면 logger.exception 으로 로그만 남기고 원래 에러 raise
    """
    app = await get_by_id(application_id)

    # 중복 호출 안전: 이미 approved면 기존 결과 반환
    if app.status == "approved":
        if not (app.created_academy_id and app.created_owner_user_id):
            # 데이터 일관성 깨짐 — DB CHECK가 막아야 하지만 보호
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "approved 신청의 audit 컬럼이 비어있습니다.",
            )
        return ApprovalResult(
            academy_id=app.created_academy_id,
            owner_user_id=app.created_owner_user_id,
            invite_sent=False,
            already_approved=True,
        )

    if app.status != "pending":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "이미 처리된 신청입니다.",
        )

    client = await get_admin_client()

    # 1. academies INSERT
    try:
        academy_resp = await (
            client.table("academy")
            .insert(
                {
                    "name": app.academy_name,
                    "status": "active",
                    "created_by": admin_user_id,
                }
            )
            .execute()
        )
    except Exception:
        logger.exception("academy insert failed (app=%s)", application_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "학원 생성 실패",
        ) from None

    if not academy_resp.data:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "학원 생성 응답 비정상"
        )
    academy_id = academy_resp.data[0]["id"]

    # 2. Supabase Auth invite_user_by_email — 초대 메일 자동 발송
    try:
        auth_resp = await client.auth.admin.invite_user_by_email(
            app.applicant_email,
            options={
                "data": {"role": "owner", "display_name": app.applicant_name}
            },
        )
        if not auth_resp.user:
            raise RuntimeError("invite returned no user")
        owner_user_id = auth_resp.user.id
    except Exception:
        logger.exception(
            "invite_user_by_email failed (email=%s)", app.applicant_email
        )
        await _safe_delete_academy(client, academy_id)
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "원장 이메일이 이미 등록되어 있거나 초대 메일 발송에 실패했습니다.",
        ) from None

    # 3. users INSERT
    try:
        await (
            client.table("users")
            .insert(
                {
                    "id": owner_user_id,
                    "email": app.applicant_email,
                    "role": "owner",
                    "display_name": app.applicant_name,
                }
            )
            .execute()
        )
    except Exception:
        logger.exception("users insert failed (user=%s)", owner_user_id)
        await _safe_delete_auth_user(client, owner_user_id)
        await _safe_delete_academy(client, academy_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "원장 프로필 생성 실패"
        ) from None

    # 4. owners INSERT (academy ↔ owner 연결)
    try:
        await (
            client.table("owners")
            .insert({"user_id": owner_user_id, "academy_id": academy_id})
            .execute()
        )
    except Exception:
        logger.exception("owners insert failed (user=%s)", owner_user_id)
        await _safe_delete_users_row(client, owner_user_id)
        await _safe_delete_auth_user(client, owner_user_id)
        await _safe_delete_academy(client, academy_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "원장-학원 연결 실패"
        ) from None

    # 5. application UPDATE
    try:
        await (
            client.table("academy_applications")
            .update(
                {
                    "status": "approved",
                    "approved_at": datetime.now(timezone.utc).isoformat(),
                    "decided_by": admin_user_id,
                    "created_academy_id": academy_id,
                    "created_owner_user_id": owner_user_id,
                }
            )
            .eq("id", application_id)
            .execute()
        )
    except Exception:
        logger.exception(
            "application status update failed (app=%s)", application_id
        )
        # 이 단계 실패는 orphan 자원 남김 — admin이 수동 점검 필요.
        # rollback은 시도 안 함 (오히려 부분 cleanup이 더 위험)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "신청 상태 업데이트 실패 — 관리자에게 문의하세요.",
        ) from None

    # 6. audit_log
    await audit_log.log(
        admin_user_id,
        action="approve_application",
        academy_id=academy_id,
        target_table="academy_applications",
        target_id=application_id,
        metadata={"owner_user_id": owner_user_id},
    )

    return ApprovalResult(
        academy_id=academy_id,
        owner_user_id=owner_user_id,
        invite_sent=True,
        already_approved=False,
    )


# --- 보상 트랜잭션 helpers (cleanup용. 실패해도 raise 안 함, 로그만) ---


async def _safe_delete_academy(client, academy_id: str) -> None:
    try:
        await client.table("academy").delete().eq("id", academy_id).execute()
    except Exception:
        logger.exception("rollback: delete academy failed (id=%s)", academy_id)


async def _safe_delete_users_row(client, user_id: str) -> None:
    try:
        await client.table("users").delete().eq("id", user_id).execute()
    except Exception:
        logger.exception("rollback: delete users row failed (id=%s)", user_id)


async def _safe_delete_auth_user(client, user_id: str) -> None:
    try:
        await client.auth.admin.delete_user(user_id)
    except Exception:
        logger.exception("rollback: delete auth user failed (id=%s)", user_id)
