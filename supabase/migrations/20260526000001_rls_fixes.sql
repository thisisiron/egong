-- Fix Issue A: is_admin() needs SECURITY DEFINER + search_path
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT current_user_role() = 'admin'
$$;

-- Fix Issue B: users_owner_update must not allow admin promotion
DROP POLICY IF EXISTS users_owner_update ON users;
CREATE POLICY users_owner_update ON users FOR UPDATE TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (
        academy_id = current_user_academy()
        AND role <> 'admin'
    );

-- Fix Issue C: parents_owner_all is split into insert (no linkage check) + modify (linkage required)
DROP POLICY IF EXISTS parents_owner_all ON parents;

CREATE POLICY parents_owner_insert ON parents FOR INSERT TO authenticated
    WITH CHECK (current_user_role() = 'owner');

CREATE POLICY parents_owner_select ON parents FOR SELECT TO authenticated
    USING (
        current_user_role() = 'owner'
        AND id IN (
            SELECT sp.parent_id FROM student_parent sp
            JOIN students s ON s.id = sp.student_id
            WHERE s.academy_id = current_user_academy()
        )
    );

CREATE POLICY parents_owner_update ON parents FOR UPDATE TO authenticated
    USING (
        current_user_role() = 'owner'
        AND id IN (
            SELECT sp.parent_id FROM student_parent sp
            JOIN students s ON s.id = sp.student_id
            WHERE s.academy_id = current_user_academy()
        )
    )
    WITH CHECK (current_user_role() = 'owner');

CREATE POLICY parents_owner_delete ON parents FOR DELETE TO authenticated
    USING (
        current_user_role() = 'owner'
        AND id IN (
            SELECT sp.parent_id FROM student_parent sp
            JOIN students s ON s.id = sp.student_id
            WHERE s.academy_id = current_user_academy()
        )
    );
