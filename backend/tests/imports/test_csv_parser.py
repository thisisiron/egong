from io import StringIO

import pytest

from src.imports.service import (
    ParseError,
    parse_classes_csv,
    parse_students_csv,
    parse_teachers_csv,
)


def test_parse_students_csv_ok():
    content = StringIO("name,school,grade\n홍길동,양산고,1\n김철수,양산여고,2\n")
    rows = parse_students_csv(content)
    assert len(rows) == 2
    assert rows[0]["name"] == "홍길동"
    assert rows[1]["school"] == "양산여고"


def test_parse_students_csv_missing_required():
    content = StringIO("school,grade\n양산고,1\n")
    with pytest.raises(ParseError, match="name"):
        parse_students_csv(content)


def test_parse_students_csv_empty_name_row():
    content = StringIO("name,school,grade\n,양산고,1\n")
    with pytest.raises(ParseError, match="row 1"):
        parse_students_csv(content)


def test_parse_teachers_csv_ok():
    content = StringIO(
        "email,display_name,temp_password,phone\nt1@x.com,김선생,Pw1234567,010\n"
    )
    rows = parse_teachers_csv(content)
    assert rows[0]["email"] == "t1@x.com"
    assert rows[0]["temp_password"] == "Pw1234567"


def test_parse_classes_csv_ok():
    content = StringIO("name,level,description\nC2-GN1,high,고1\n")
    rows = parse_classes_csv(content)
    assert rows[0]["level"] == "high"


def test_parse_classes_csv_invalid_level():
    content = StringIO("name,level\nC2,senior\n")
    with pytest.raises(ParseError, match="level"):
        parse_classes_csv(content)
