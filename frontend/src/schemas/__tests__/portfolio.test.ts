import { ContactFormSchema, PositionItemSchema } from '../portfolio'

describe('ContactFormSchema', () => {
  it('rejects empty name', () => {
    const result = ContactFormSchema.safeParse({ name: '', email: 'a@b.com', message: 'hi' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = ContactFormSchema.safeParse({ name: 'Alice', email: 'not-an-email', message: 'hi' })
    expect(result.success).toBe(false)
  })

  it('rejects message > 5000 chars', () => {
    const result = ContactFormSchema.safeParse({ name: 'Alice', email: 'a@b.com', message: 'x'.repeat(5001) })
    expect(result.success).toBe(false)
  })

  it('accepts valid contact form', () => {
    const result = ContactFormSchema.safeParse({ name: 'Alice', email: 'a@b.com', message: 'Hello!' })
    expect(result.success).toBe(true)
  })
})

describe('PositionItemSchema', () => {
  it('requires id and position', () => {
    const result = PositionItemSchema.safeParse({ id: 'not-a-uuid', position: 1 })
    expect(result.success).toBe(false)
  })
})
