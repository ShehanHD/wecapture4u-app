import { z } from 'zod'

/**
 * Accepts a JSON number or string and normalises to string.
 * Needed because Pydantic v2 serialises Decimal as a JSON number,
 * while our domain code expects string (preserving decimal precision).
 */
export const numericString = z.union([z.string(), z.number()]).transform(String)
