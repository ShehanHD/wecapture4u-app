import { NotificationSchema } from '../notifications'
import { AppSettingsSchema, SessionTypeSchema } from '../settings'
import { AppointmentSchema } from '../appointments'

describe('NotificationSchema', () => {
  it('parses a valid notification', () => {
    const result = NotificationSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      type: 'appointment_reminder',
      title: 'Reminder',
      body: 'You have an appointment',
      read: false,
      sent_email: true,
      created_at: '2026-01-01T08:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('AppSettingsSchema', () => {
  it('parses valid app settings', () => {
    const result = AppSettingsSchema.safeParse({
      id: 1,
      tax_enabled: false,
      tax_rate: '0.00',
      pdf_invoices_enabled: true,
      updated_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('SessionTypeSchema', () => {
  it('parses a valid session type', () => {
    const result = SessionTypeSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Wedding',
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('AppointmentSchema', () => {
  it('parses a valid appointment', () => {
    const result = AppointmentSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      client_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      session_type_id: null,
      session_type: null,
      title: 'Wedding shoot',
      starts_at: '2026-06-01T10:00:00Z',
      ends_at: null,
      location: null,
      status: 'pending',
      addons: [],
      deposit_paid: false,
      deposit_amount: '0.00',
      deposit_account_id: null,
      contract_signed: false,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = AppointmentSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      client_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      title: 'Test',
      starts_at: '2026-06-01T10:00:00Z',
      status: 'invalid_status',
      addons: [],
      deposit_paid: false,
      deposit_amount: '0',
      contract_signed: false,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})
