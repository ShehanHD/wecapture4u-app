from models.client import Client
from models.session_type import SessionType
from models.appointment import Appointment
from models.job import JobStage, Job
from models.invoice import Invoice, InvoiceItem
from models.notification import Notification
from models.admin import AppSettings


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


def test_invoice_tablename():
    assert Invoice.__tablename__ == "invoices"


def test_invoice_columns():
    cols = {c.name for c in Invoice.__table__.columns}
    assert {
        "id", "job_id", "client_id", "status", "subtotal", "discount", "tax",
        "total", "deposit_amount", "balance_due", "requires_review",
        "due_date", "sent_at", "paid_at", "created_at"
    }.issubset(cols)


def test_invoice_item_tablename():
    assert InvoiceItem.__tablename__ == "invoice_items"


def test_invoice_item_columns():
    cols = {c.name for c in InvoiceItem.__table__.columns}
    assert {
        "id", "invoice_id", "revenue_account_id", "description",
        "quantity", "unit_price", "amount"
    }.issubset(cols)


def test_invoice_job_id_nullable():
    assert Invoice.__table__.c["job_id"].nullable is True


def test_invoice_item_revenue_account_id_nullable():
    assert InvoiceItem.__table__.c["revenue_account_id"].nullable is True


def test_notification_tablename():
    assert Notification.__tablename__ == "notifications"


def test_notification_columns():
    cols = {c.name for c in Notification.__table__.columns}
    assert {"id", "user_id", "type", "title", "body", "read", "sent_email", "created_at"}.issubset(cols)


def test_app_settings_tablename():
    assert AppSettings.__tablename__ == "app_settings"


def test_app_settings_columns():
    cols = {c.name for c in AppSettings.__table__.columns}
    assert {"id", "tax_enabled", "tax_rate", "pdf_invoices_enabled", "updated_at"}.issubset(cols)
