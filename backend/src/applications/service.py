"""Academy application domain logic.

- submit: public (no auth, called via router)
- list/get_by_id: admin only
- signed_download_url: admin only — generate signed URL for business doc download

All Supabase calls use the service-role client (bypasses RLS for our trusted ops).
The anon-facing surface is enforced by the router's dependency-less endpoint
and by table/storage RLS at the DB layer.
"""

import logging

from fastapi import HTTPException, status

from src.common.supabase_admin import get_admin_client

from .schemas import ApplicationOut, ApplicationSubmit, SignedDownloadUrl

logger = logging.getLogger(__name__)


async def submit(payload: ApplicationSubmit) -> None:
    """Insert a new pending application. No auth required."""
    client = await get_admin_client()
    try:
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
