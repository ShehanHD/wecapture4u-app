import uuid
from schemas.clients import ClientCreate, ClientOut
from schemas.settings import AppSettingsOut, SessionTypeCreate, SessionTypeOut
from schemas.appointments import AppointmentCreate, AppointmentOut
from schemas.jobs import JobCreate, JobStageOut, StagePositionReorder


def test_client_create_requires_name_and_email():
    from pydantic import ValidationError
    import pytest
    with pytest.raises(ValidationError):
        ClientCreate(name="Alice")  # missing email


def test_client_create_valid():
    c = ClientCreate(name="Alice", email="alice@example.com")
    assert c.name == "Alice"
    assert c.email == "alice@example.com"
    assert c.tags == []


def test_client_out_from_orm():
    c = ClientOut.model_validate({
        "id": uuid.uuid4(),
        "user_id": None,
        "name": "Alice",
        "email": "alice@example.com",
        "phone": None,
        "address": None,
        "tags": [],
        "birthday": None,
        "notes": None,
        "created_at": "2026-01-01T00:00:00Z",
    })
    assert c.name == "Alice"


def test_session_type_create_requires_name():
    from pydantic import ValidationError
    import pytest
    with pytest.raises(ValidationError):
        SessionTypeCreate()


def test_app_settings_out_defaults():
    s = AppSettingsOut.model_validate({
        "id": 1, "tax_enabled": False, "tax_rate": "0.00",
        "pdf_invoices_enabled": False, "updated_at": "2026-01-01T00:00:00Z"
    })
    assert s.tax_enabled is False


def test_appointment_create_valid():
    from datetime import datetime, timezone
    a = AppointmentCreate(
        client_id=uuid.uuid4(),
        title="Wedding shoot",
        starts_at=datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc),
    )
    assert a.status == "pending"
    assert a.addons == []


def test_appointment_create_invalid_status():
    from pydantic import ValidationError
    from datetime import datetime, timezone
    import pytest
    with pytest.raises(ValidationError):
        AppointmentCreate(
            client_id=uuid.uuid4(),
            title="Test",
            starts_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
            status="invalid_status",
        )


def test_job_create_requires_client_title_stage():
    from pydantic import ValidationError
    import pytest
    with pytest.raises(ValidationError):
        JobCreate(title="My Job")  # missing client_id and stage_id


def test_stage_position_reorder_valid():
    items = [
        {"id": str(uuid.uuid4()), "position": 1},
        {"id": str(uuid.uuid4()), "position": 2},
    ]
    r = StagePositionReorder(stages=items)
    assert len(r.stages) == 2
