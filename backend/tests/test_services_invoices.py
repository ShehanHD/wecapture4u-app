import pytest
from decimal import Decimal
from unittest.mock import MagicMock
from services.invoices import compute_item_amount, compute_invoice_totals


def test_compute_item_amount():
    assert compute_item_amount(Decimal("3"), Decimal("150")) == Decimal("450")


def test_compute_item_amount_fractional():
    assert compute_item_amount(Decimal("1.5"), Decimal("200")) == Decimal("300.00")


def test_compute_invoice_totals_no_discount_no_tax():
    items = [
        MagicMock(amount=Decimal("500")),
        MagicMock(amount=Decimal("200")),
    ]
    subtotal, total, balance_due = compute_invoice_totals(
        items=items, discount=Decimal("0"), tax=Decimal("0"), payments_sum=Decimal("0")
    )
    assert subtotal == Decimal("700")
    assert total == Decimal("700")
    assert balance_due == Decimal("700")


def test_compute_invoice_totals_with_discount_and_tax():
    items = [MagicMock(amount=Decimal("1000"))]
    subtotal, total, balance_due = compute_invoice_totals(
        items=items, discount=Decimal("100"), tax=Decimal("50"), payments_sum=Decimal("200")
    )
    assert subtotal == Decimal("1000")
    assert total == Decimal("950")   # 1000 - 100 + 50
    assert balance_due == Decimal("750")  # 950 - 200


def test_compute_invoice_totals_fully_paid():
    items = [MagicMock(amount=Decimal("500"))]
    _, total, balance_due = compute_invoice_totals(
        items=items, discount=Decimal("0"), tax=Decimal("0"), payments_sum=Decimal("500")
    )
    assert balance_due == Decimal("0")
