-- Widen parents owner policies to include parents in the owner's academy
-- even if not yet linked to a student (allows "register parent first, link later" UX)

DROP POLICY IF EXISTS parents_owner_select ON parents;
CREATE POLICY parents_owner_select ON parents FOR SELECT TO authenticated
  USING (
    current_user_role() = 'owner'
    AND (
      id IN (
        SELECT sp.parent_id FROM student_parent sp
        JOIN students s ON s.id = sp.student_id
        WHERE s.academy_id = current_user_academy()
      )
      OR user_id IN (
        SELECT u.id FROM users u
        WHERE u.academy_id = current_user_academy() AND u.role = 'parent'
      )
    )
  );

DROP POLICY IF EXISTS parents_owner_update ON parents;
CREATE POLICY parents_owner_update ON parents FOR UPDATE TO authenticated
  USING (
    current_user_role() = 'owner'
    AND (
      id IN (
        SELECT sp.parent_id FROM student_parent sp
        JOIN students s ON s.id = sp.student_id
        WHERE s.academy_id = current_user_academy()
      )
      OR user_id IN (
        SELECT u.id FROM users u
        WHERE u.academy_id = current_user_academy() AND u.role = 'parent'
      )
    )
  )
  WITH CHECK (current_user_role() = 'owner');

DROP POLICY IF EXISTS parents_owner_delete ON parents;
CREATE POLICY parents_owner_delete ON parents FOR DELETE TO authenticated
  USING (
    current_user_role() = 'owner'
    AND (
      id IN (
        SELECT sp.parent_id FROM student_parent sp
        JOIN students s ON s.id = sp.student_id
        WHERE s.academy_id = current_user_academy()
      )
      OR user_id IN (
        SELECT u.id FROM users u
        WHERE u.academy_id = current_user_academy() AND u.role = 'parent'
      )
    )
  );
