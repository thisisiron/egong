-- 테스트용 admin 계정 (수동으로 auth.users에 INSERT 어렵기 때문에 노트만 둠)
-- 실제 admin은 Supabase Studio > Authentication에서 만든 뒤 아래 SQL로 role 부여

-- 예시:
-- INSERT INTO users (id, academy_id, role, display_name)
-- VALUES ('<admin-auth-uuid>', NULL, 'admin', '시스템 관리자');

-- 빈 채로 두고, Task 5에서 Admin이 학원을 생성하도록 함
