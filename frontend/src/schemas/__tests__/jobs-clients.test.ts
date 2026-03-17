import { JobStageSchema, JobSchema } from '../jobs'
import { ClientSchema, ClientWithStatsSchema } from '../clients'

describe('JobStageSchema', () => {
  it('parses valid stage', () => {
    const result = JobStageSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Booked',
      color: '#f59e0b',
      position: 1,
      is_terminal: false,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('JobSchema', () => {
  it('parses valid job', () => {
    const result = JobSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      client_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      client: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Alice', email: 'alice@example.com' },
      appointment_id: null,
      title: 'Wedding photos',
      stage_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      shoot_date: null,
      delivery_deadline: null,
      delivery_url: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('ClientWithStatsSchema', () => {
  it('parses client with stats', () => {
    const result = ClientWithStatsSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      user_id: null,
      name: 'Alice',
      email: 'alice@example.com',
      phone: null,
      address: null,
      tags: ['wedding'],
      birthday: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
      total_spent: 1500.0,
      is_active: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('ClientSchema', () => {
  it('parses basic client', () => {
    const result = ClientSchema.safeParse({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      user_id: null,
      name: 'Bob',
      email: 'bob@example.com',
      phone: null,
      address: null,
      tags: [],
      birthday: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })
})
