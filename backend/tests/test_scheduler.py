import pytest
from datetime import date, timedelta


def test_is_birthday_today_match():
    from scheduler import is_birthday_today
    today = date.today()
    assert is_birthday_today(date(1990, today.month, today.day)) is True


def test_is_birthday_today_no_match():
    from scheduler import is_birthday_today
    yesterday = date.today() - timedelta(days=1)
    assert is_birthday_today(date(1990, yesterday.month, yesterday.day)) is False


def test_is_invoice_overdue():
    from scheduler import is_invoice_overdue
    yesterday = date.today() - timedelta(days=1)
    assert is_invoice_overdue(yesterday, "sent") is True


def test_invoice_not_overdue_if_paid():
    from scheduler import is_invoice_overdue
    yesterday = date.today() - timedelta(days=1)
    assert is_invoice_overdue(yesterday, "paid") is False


def test_invoice_not_overdue_if_due_date_in_future():
    from scheduler import is_invoice_overdue
    tomorrow = date.today() + timedelta(days=1)
    assert is_invoice_overdue(tomorrow, "sent") is False
