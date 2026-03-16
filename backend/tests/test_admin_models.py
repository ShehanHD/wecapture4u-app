from models.client import Client
from models.session_type import SessionType


def test_client_tablename():
    assert Client.__tablename__ == "clients"


def test_client_has_required_columns():
    cols = {c.name for c in Client.__table__.columns}
    assert {"id", "user_id", "name", "email", "phone", "address",
            "tags", "birthday", "notes", "created_at"}.issubset(cols)


def test_client_user_id_nullable():
    col = Client.__table__.c["user_id"]
    assert col.nullable is True


def test_session_type_tablename():
    assert SessionType.__tablename__ == "session_types"


def test_session_type_has_required_columns():
    cols = {c.name for c in SessionType.__table__.columns}
    assert {"id", "name", "created_at"}.issubset(cols)
