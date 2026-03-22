import pytest
import uuid
from services.settings import validate_stage_position_set


def test_validate_stage_position_set_raises_on_mismatch():
    from fastapi import HTTPException
    existing_ids = {uuid.uuid4(), uuid.uuid4()}
    incoming_ids = {uuid.uuid4()}  # different set
    with pytest.raises(HTTPException) as exc:
        validate_stage_position_set(existing_ids, incoming_ids)
    assert exc.value.status_code == 422
