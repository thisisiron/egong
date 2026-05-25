CREATE TYPE attendance_status AS ENUM ('present', 'late', 'absent', 'excused');

CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    scheduled_at timestamptz NOT NULL,
    title text NOT NULL,
    unit text,
    video_url text,
    video_notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_class ON sessions(class_id);
CREATE INDEX idx_sessions_scheduled ON sessions(scheduled_at);

CREATE TABLE attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status attendance_status NOT NULL,
    excused_reason text,
    needs_makeup boolean NOT NULL DEFAULT false,
    marked_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
    marked_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, student_id)
);
CREATE INDEX idx_attendance_session ON attendance(session_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);

-- RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- SESSIONS
CREATE POLICY sessions_admin_all ON sessions FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY sessions_owner_all ON sessions FOR ALL TO authenticated
    USING (
        current_user_role() = 'owner'
        AND class_id IN (SELECT id FROM classes WHERE academy_id = current_user_academy())
    )
    WITH CHECK (class_id IN (SELECT id FROM classes WHERE academy_id = current_user_academy()));

CREATE POLICY sessions_teacher_all ON sessions FOR ALL TO authenticated
    USING (
        current_user_role() = 'teacher'
        AND class_id IN (
            SELECT ct.class_id FROM class_teachers ct
            JOIN teachers t ON t.id = ct.teacher_id
            WHERE t.user_id = auth.uid()
        )
    )
    WITH CHECK (
        class_id IN (
            SELECT ct.class_id FROM class_teachers ct
            JOIN teachers t ON t.id = ct.teacher_id
            WHERE t.user_id = auth.uid()
        )
    );

CREATE POLICY sessions_student_read ON sessions FOR SELECT TO authenticated
    USING (
        class_id IN (
            SELECT cs.class_id FROM class_students cs
            JOIN students s ON s.id = cs.student_id
            WHERE s.user_id = auth.uid() AND cs.left_at IS NULL
        )
    );

CREATE POLICY sessions_parent_read ON sessions FOR SELECT TO authenticated
    USING (
        class_id IN (
            SELECT cs.class_id FROM class_students cs
            JOIN student_parent sp ON sp.student_id = cs.student_id
            JOIN parents p ON p.id = sp.parent_id
            WHERE p.user_id = auth.uid() AND cs.left_at IS NULL
        )
    );

-- ATTENDANCE
CREATE POLICY att_admin_all ON attendance FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY att_owner_all ON attendance FOR ALL TO authenticated
    USING (
        current_user_role() = 'owner'
        AND session_id IN (
            SELECT s.id FROM sessions s
            JOIN classes c ON c.id = s.class_id
            WHERE c.academy_id = current_user_academy()
        )
    )
    WITH CHECK (
        session_id IN (
            SELECT s.id FROM sessions s
            JOIN classes c ON c.id = s.class_id
            WHERE c.academy_id = current_user_academy()
        )
    );

CREATE POLICY att_teacher_all ON attendance FOR ALL TO authenticated
    USING (
        current_user_role() = 'teacher'
        AND session_id IN (
            SELECT s.id FROM sessions s
            JOIN class_teachers ct ON ct.class_id = s.class_id
            JOIN teachers t ON t.id = ct.teacher_id
            WHERE t.user_id = auth.uid()
        )
    )
    WITH CHECK (
        session_id IN (
            SELECT s.id FROM sessions s
            JOIN class_teachers ct ON ct.class_id = s.class_id
            JOIN teachers t ON t.id = ct.teacher_id
            WHERE t.user_id = auth.uid()
        )
    );

CREATE POLICY att_student_read ON attendance FOR SELECT TO authenticated
    USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY att_parent_read ON attendance FOR SELECT TO authenticated
    USING (
        student_id IN (
            SELECT sp.student_id FROM student_parent sp
            JOIN parents p ON p.id = sp.parent_id
            WHERE p.user_id = auth.uid()
        )
    );
