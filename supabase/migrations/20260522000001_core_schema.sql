-- ===== ENUMS =====
CREATE TYPE user_role AS ENUM ('admin', 'owner', 'teacher', 'student', 'parent');
CREATE TYPE academy_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE student_status AS ENUM ('enrolled', 'paused', 'graduated');
CREATE TYPE class_level AS ENUM ('elementary', 'middle', 'high');
CREATE TYPE parent_relationship AS ENUM ('mother', 'father', 'other');

-- ===== ACADEMY =====
CREATE TABLE academy (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    settings jsonb NOT NULL DEFAULT '{"late_weight": 0.4, "absent_weight": 1.0}'::jsonb,
    status academy_status NOT NULL DEFAULT 'active',
    contract_started_at date,
    created_by uuid,  -- FK added later (circular with users)
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== USERS (Supabase auth.users 확장) =====
CREATE TABLE users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    academy_id uuid REFERENCES academy(id) ON DELETE SET NULL,  -- admin은 NULL
    role user_role NOT NULL,
    display_name text NOT NULL,
    phone text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE academy ADD CONSTRAINT academy_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_users_academy ON users(academy_id);
CREATE INDEX idx_users_role ON users(role);

-- ===== TEACHERS =====
CREATE TABLE teachers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    academy_id uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_teachers_academy ON teachers(academy_id);

-- ===== STUDENTS =====
CREATE TABLE students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    user_id uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,  -- nullable (초등)
    name text NOT NULL,
    school text,
    grade text,
    status student_status NOT NULL DEFAULT 'enrolled',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_academy ON students(academy_id);
CREATE INDEX idx_students_user ON students(user_id);

-- ===== PARENTS =====
CREATE TABLE parents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== STUDENT-PARENT (N:N) =====
CREATE TABLE student_parent (
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    relationship parent_relationship NOT NULL DEFAULT 'other',
    PRIMARY KEY (student_id, parent_id)
);
CREATE INDEX idx_sp_parent ON student_parent(parent_id);

-- ===== CLASSES =====
CREATE TABLE classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id uuid NOT NULL REFERENCES academy(id) ON DELETE CASCADE,
    name text NOT NULL,
    level class_level NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_classes_academy ON classes(academy_id);

-- ===== CLASS-TEACHER (N:N) =====
CREATE TABLE class_teachers (
    class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    PRIMARY KEY (class_id, teacher_id)
);
CREATE INDEX idx_ct_teacher ON class_teachers(teacher_id);

-- ===== CLASS-STUDENT (N:N + 이력) =====
CREATE TABLE class_students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    joined_at date NOT NULL DEFAULT CURRENT_DATE,
    left_at date  -- NULL = 현재 배정 중
);
CREATE INDEX idx_cs_class ON class_students(class_id);
CREATE INDEX idx_cs_student ON class_students(student_id);
CREATE UNIQUE INDEX idx_cs_active ON class_students(class_id, student_id) WHERE left_at IS NULL;
