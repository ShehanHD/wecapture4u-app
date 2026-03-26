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


@pytest.mark.asyncio
async def test_invoice_item_revenue_account_fk(db_session: AsyncSession):
    """InvoiceItem.revenue_account_id FK references accounts table correctly."""
    from models.invoice import Invoice, InvoiceItem
    from models.client import Client

    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '4000'"))
    session_fees_id = result.scalar_one()

    client = Client(name="FK Test", email=f"fk_{uuid4().hex[:8]}@test.internal", tags=[])
    db_session.add(client)
    await db_session.flush()

    invoice = Invoice(client_id=client.id, status="draft")
    db_session.add(invoice)
    await db_session.flush()

    item = InvoiceItem(
        invoice_id=invoice.id,
        description="Session",
        quantity=Decimal("1"),
        unit_price=Decimal("300.00"),
        amount=Decimal("300.00"),
        revenue_account_id=session_fees_id,
    )
    db_session.add(item)
    await db_session.flush()

    result = await db_session.execute(
        select(InvoiceItem).where(InvoiceItem.id == item.id)
    )
    fetched = result.scalar_one()
    assert fetched.revenue_account_id == session_fees_id


@pytest.mark.asyncio
async def test_journal_entry_with_lines(db_session: AsyncSession):
    """JournalEntry with two balanced JournalLines can be created and related."""
    from models.journal import JournalEntry, JournalLine

    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1100'"))
    ar_id = result.scalar_one()
    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '4000'"))
    fees_id = result.scalar_one()

    entry = JournalEntry(
        date=date.today(),
        description="Invoice sent - test",
        reference_type="invoice",
        reference_id=uuid4(),
        status="draft",
        created_by="system",
    )
    db_session.add(entry)
    await db_session.flush()

    dr_line = JournalLine(
        entry_id=entry.id, account_id=ar_id,
        debit=Decimal("500.00"), credit=Decimal("0"),
    )
    cr_line = JournalLine(
        entry_id=entry.id, account_id=fees_id,
        debit=Decimal("0"), credit=Decimal("500.00"),
    )
    db_session.add_all([dr_line, cr_line])
    await db_session.flush()

    await db_session.refresh(entry, ["lines"])
    assert len(entry.lines) == 2
    assert entry.status == "draft"
    assert entry.created_by == "system"


@pytest.mark.asyncio
async def test_expense_model_create(db_session: AsyncSession):
    """Expense model supports paid and payable payment_status values."""
    from models.expense import Expense

    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '5000'"))
    equipment_id = result.scalar_one()
    result = await db_session.execute(text("SELECT id FROM accounts WHERE code = '1010'"))
    bank_id = result.scalar_one()

    paid_expense = Expense(
        date=date.today(),
        description="Camera lens",
        expense_account_id=equipment_id,
        amount=Decimal("800.00"),
        payment_status="paid",
        payment_account_id=bank_id,
    )
    db_session.add(paid_expense)
    await db_session.flush()
    assert paid_expense.id is not None
    assert paid_expense.payment_status == "paid"

    payable_expense = Expense(
        date=date.today(),
        description="Print order",
        expense_account_id=equipment_id,
        amount=Decimal("200.00"),
        payment_status="payable",
    )
    db_session.add(payable_expense)
    await db_session.flush()
    assert payable_expense.payment_account_id is None
