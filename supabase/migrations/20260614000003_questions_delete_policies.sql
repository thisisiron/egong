-- 질문 삭제 권한 보강:
--  기존 마이그레이션엔 questions에 owner_all/admin_all(FOR ALL)만 있어 학생/선생이 삭제 불가(조용히 0행).
--  작성 학생 본인 + 담당 선생(teacher=owner parity)에게 DELETE 권한을 부여한다.
--  (owner/admin은 기존 *_all 정책으로 이미 삭제 가능 → 추가 안 함.)
--  답글(question_replies)은 questions FK가 ON DELETE CASCADE라 질문 삭제 시 DB 레벨에서 함께 삭제된다.

CREATE POLICY questions_student_delete ON questions FOR DELETE TO authenticated
    USING (current_user_role() = 'student' AND student_id IN (SELECT app_my_student_ids()));

CREATE POLICY questions_teacher_delete ON questions FOR DELETE TO authenticated
    USING (current_user_role() = 'teacher' AND class_id IN (SELECT app_my_taught_class_ids()));
