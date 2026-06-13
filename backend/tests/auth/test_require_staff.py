import pytest
from fastapi import HTTPException
from src.auth.dependencies import CurrentUser, require_owner_or_teacher


@pytest.mark.asyncio
async def test_owner_and_teacher_pass_others_fail():
    for role in ('owner', 'teacher'):
        u = CurrentUser('u1', role, 'acad1')
        assert (await require_owner_or_teacher(u)) is u
    for role in ('student', 'parent', 'admin'):
        with pytest.raises(HTTPException) as ei:
            await require_owner_or_teacher(CurrentUser('u1', role, 'acad1'))
        assert ei.value.status_code == 403
