import pytest
from uuid import uuid4
from decimal import Decimal
from datetime import date
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_invoice_payment_uses_payment_date_and_account_id(db_session: AsyncSession):
    """InvoicePayment model must use payment_date + account_id, not paid_at + method."""
    from models.client import Client
    from models.invoice import Invoice, InvoicePayment

    client = Client(name="Acct Test", email=f"acct_{uuid4().hex[:8]}@test.internal", tags=[])
    db_session.add(client)
    await db_session.flush()

    invoice = Invoice(client_id=client.id, status="sent")
    db_session.add(invoice)
    await db_session.flush()

    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1010'"))
    account_id = result.scalar_one()

    payment = InvoicePayment(
        invoice_id=invoice.id,
        amount=Decimal("100.00"),
        payment_date=date.today(),
        account_id=account_id,
        notes="Test payment",
    )
    db_session.add(payment)
    await db_session.flush()

    assert payment.payment_date == date.today()
    assert payment.account_id == account_id


@pytest.mark.asyncio
async def test_account_model_create_and_query(db_session: AsyncSession):
    """Seeded accounts exist and new custom accounts can be created."""
    from models.account import Account

    # Verify seeded Business Bank Account
    result = await db_session.execute(
        select(Account).where(Account.code == "1010")
    )
    bank = result.scalar_one()
    assert bank.name == "Business Bank Account"
    assert bank.type == "asset"
    assert bank.normal_balance == "debit"
    assert bank.is_system is True
    assert bank.archived is False

    # Create a custom account
    acct = Account(
        code="9001",
        name="Test Custom Account",
        type="expense",
        normal_balance="debit",
        is_system=False,
    )
    db_session.add(acct)
    await db_session.flush()
    assert acct.id is not None
    assert acct.archived is False
