import pytest
from services.clients import validate_portal_access_request


def test_validate_portal_access_requires_password_when_portal_true():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        validate_portal_access_request(portal_access=True, temp_password=None)
    assert exc.value.status_code == 422


def test_validate_portal_access_ok_when_password_provided():
    # Should not raise
    validate_portal_access_request(portal_access=True, temp_password="TempPass123!")


def test_validate_portal_access_ok_when_portal_false():
    # No password needed when portal_access=False
    validate_portal_access_request(portal_access=False, temp_password=None)
