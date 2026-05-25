-- 모든 테이블 RLS 활성화
ALTER TABLE academy ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_parent ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;

-- ===== 도우미 함수 =====
CREATE OR REPLACE FUNCTION current_user_role() RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION current_user_academy() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT academy_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT current_user_role() = 'admin'
$$;

-- ===== ACADEMY =====
CREATE POLICY academy_admin_all ON academy FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY academy_member_read ON academy FOR SELECT TO authenticated
    USING (id = current_user_academy());

-- ===== USERS =====
CREATE POLICY users_admin_all ON users FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY users_self_read ON users FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY users_owner_read_academy ON users FOR SELECT TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy());

CREATE POLICY users_owner_insert ON users FOR INSERT TO authenticated
    WITH CHECK (current_user_role() = 'owner' AND academy_id = current_user_academy());

CREATE POLICY users_owner_update ON users FOR UPDATE TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (academy_id = current_user_academy());

-- ===== TEACHERS =====
CREATE POLICY teachers_admin_all ON teachers FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY teachers_owner_all ON teachers FOR ALL TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (academy_id = current_user_academy());

CREATE POLICY teachers_self_read ON teachers FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- ===== STUDENTS =====
CREATE POLICY students_admin_all ON students FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY students_owner_all ON students FOR ALL TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (academy_id = current_user_academy());

CREATE POLICY students_teacher_read ON students FOR SELECT TO authenticated
    USING (
        current_user_role() = 'teacher' AND id IN (
            SELECT cs.student_id FROM class_students cs
            JOIN class_teachers ct ON ct.class_id = cs.class_id
            JOIN teachers t ON t.id = ct.teacher_id
            WHERE t.user_id = auth.uid() AND cs.left_at IS NULL
        )
    );

CREATE POLICY students_self_read ON students FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY students_parent_read ON students FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT sp.student_id FROM student_parent sp
            JOIN parents p ON p.id = sp.parent_id
            WHERE p.user_id = auth.uid()
        )
    );

-- ===== PARENTS =====
CREATE POLICY parents_admin_all ON parents FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY parents_owner_all ON parents FOR ALL TO authenticated
    USING (
        current_user_role() = 'owner'
        AND id IN (
            SELECT sp.parent_id FROM student_parent sp
            JOIN students s ON s.id = sp.student_id
            WHERE s.academy_id = current_user_academy()
        )
    );

CREATE POLICY parents_self_read ON parents FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- ===== STUDENT_PARENT =====
CREATE POLICY sp_admin_all ON student_parent FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY sp_owner_all ON student_parent FOR ALL TO authenticated
    USING (
        current_user_role() = 'owner'
        AND student_id IN (SELECT id FROM students WHERE academy_id = current_user_academy())
    )
    WITH CHECK (student_id IN (SELECT id FROM students WHERE academy_id = current_user_academy()));

CREATE POLICY sp_parent_read ON student_parent FOR SELECT TO authenticated
    USING (parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()));

-- ===== CLASSES =====
CREATE POLICY classes_admin_all ON classes FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY classes_owner_all ON classes FOR ALL TO authenticated
    USING (current_user_role() = 'owner' AND academy_id = current_user_academy())
    WITH CHECK (academy_id = current_user_academy());

CREATE POLICY classes_teacher_read ON classes FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT ct.class_id FROM class_teachers ct
            JOIN teachers t ON t.id = ct.teacher_id
            WHERE t.user_id = auth.uid()
        )
    );

CREATE POLICY classes_student_read ON classes FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT cs.class_id FROM class_students cs
            JOIN students s ON s.id = cs.student_id
            WHERE s.user_id = auth.uid() AND cs.left_at IS NULL
        )
    );

CREATE POLICY classes_parent_read ON classes FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT cs.class_id FROM class_students cs
            JOIN student_parent sp ON sp.student_id = cs.student_id
            JOIN parents p ON p.id = sp.parent_id
            WHERE p.user_id = auth.uid() AND cs.left_at IS NULL
        )
    );

-- ===== CLASS_TEACHERS =====
CREATE POLICY ct_admin_all ON class_teachers FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY ct_owner_all ON class_teachers FOR ALL TO authenticated
    USING (
        current_user_role() = 'owner'
        AND class_id IN (SELECT id FROM classes WHERE academy_id = current_user_academy())
    )
    WITH CHECK (class_id IN (SELECT id FROM classes WHERE academy_id = current_user_academy()));

CREATE POLICY ct_teacher_read ON class_teachers FOR SELECT TO authenticated
    USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

-- ===== CLASS_STUDENTS =====
CREATE POLICY cs_admin_all ON class_students FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY cs_owner_all ON class_students FOR ALL TO authenticated
    USING (
        current_user_role() = 'owner'
        AND class_id IN (SELECT id FROM classes WHERE academy_id = current_user_academy())
    )
    WITH CHECK (class_id IN (SELECT id FROM classes WHERE academy_id = current_user_academy()));

CREATE POLICY cs_teacher_read ON class_students FOR SELECT TO authenticated
    USING (
        class_id IN (
            SELECT ct.class_id FROM class_teachers ct
            JOIN teachers t ON t.id = ct.teacher_id
            WHERE t.user_id = auth.uid()
        )
    );

CREATE POLICY cs_self_read ON class_students FOR SELECT TO authenticated
    USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY cs_parent_read ON class_students FOR SELECT TO authenticated
    USING (
        student_id IN (
            SELECT sp.student_id FROM student_parent sp
            JOIN parents p ON p.id = sp.parent_id
            WHERE p.user_id = auth.uid()
        )
    );
