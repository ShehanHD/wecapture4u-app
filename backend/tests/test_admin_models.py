from models.client import Client
from models.session_type import SessionType
from models.appointment import Appointment
from models.job import JobStage, Job


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


def test_appointment_tablename():
    assert Appointment.__tablename__ == "appointments"


def test_appointment_has_required_columns():
    cols = {c.name for c in Appointment.__table__.columns}
    assert {
        "id", "client_id", "session_type_id", "title", "starts_at", "ends_at",
        "location", "status", "addons", "deposit_paid", "deposit_amount",
        "deposit_account_id", "contract_signed", "notes", "created_at"
    }.issubset(cols)


def test_appointment_deposit_account_id_nullable():
    col = Appointment.__table__.c["deposit_account_id"]
    assert col.nullable is True


def test_job_stage_tablename():
    assert JobStage.__tablename__ == "job_stages"


def test_job_stage_columns():
    cols = {c.name for c in JobStage.__table__.columns}
    assert {"id", "name", "color", "position", "is_terminal", "created_at"}.issubset(cols)


def test_job_tablename():
    assert Job.__tablename__ == "jobs"


def test_job_columns():
    cols = {c.name for c in Job.__table__.columns}
    assert {
        "id", "client_id", "appointment_id", "title", "stage_id",
        "shoot_date", "delivery_deadline", "delivery_url", "notes", "created_at"
    }.issubset(cols)


def test_job_appointment_id_nullable():
    assert Job.__table__.c["appointment_id"].nullable is True
