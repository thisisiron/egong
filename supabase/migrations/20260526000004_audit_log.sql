-- ===== ADMIN AUDIT LOG =====
-- Append-only log of admin actions. INSERT happens via service_role
-- (FastAPI backend) so RLS only governs SELECT.
CREATE TABLE admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    academy_id uuid REFERENCES academy(id) ON DELETE SET NULL,
    action text NOT NULL,
    target_table text,
    target_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_admin ON admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX idx_audit_academy ON admin_audit_log(academy_id, created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit log via RLS.
-- INSERT is service_role only (RLS bypass).
CREATE POLICY audit_admin_read ON admin_audit_log FOR SELECT TO authenticated
    USING (is_admin());
