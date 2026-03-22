import pytest
import uuid
from services.jobs import should_send_stage_email, should_send_delivery_email


def test_stage_email_sent_when_stage_changes():
    assert should_send_stage_email(
        old_stage_id=uuid.uuid4(), new_stage_id=uuid.uuid4(), has_portal=True
    ) is True


def test_stage_email_not_sent_when_stage_unchanged():
    same = uuid.uuid4()
    assert should_send_stage_email(
        old_stage_id=same, new_stage_id=same, has_portal=True
    ) is False


def test_stage_email_not_sent_when_no_portal():
    assert should_send_stage_email(
        old_stage_id=uuid.uuid4(), new_stage_id=uuid.uuid4(), has_portal=False
    ) is False


def test_delivery_email_sent_when_url_goes_from_none_to_value():
    assert should_send_delivery_email(old_url=None, new_url="https://example.com/gallery") is True


def test_delivery_email_not_sent_when_url_was_already_set():
    assert should_send_delivery_email(old_url="https://old.com", new_url="https://new.com") is False


def test_delivery_email_not_sent_when_url_cleared():
    assert should_send_delivery_email(old_url="https://old.com", new_url=None) is False
