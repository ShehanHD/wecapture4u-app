import { useState, useEffect } from 'react'

const PRESETS = [
  { label: 'Cyan', value: '#0afcfd' },
  { label: 'Sky', value: '#0ea5e9' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Orange', value: '#f97316' },
]

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function darken(hex: string, amount = 0.25): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) * (1 - amount))
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) * (1 - amount))
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) * (1 - amount))
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`
}

function applyColor(hex: string) {
  const root = document.documentElement
  const isDark = root.classList.contains('dark')
  const primary = isDark ? hex : darken(hex, 0.4)
  root.style.setProperty('--primary', primary)
  root.style.setProperty('--ring', hexToRgba(hex, 0.4))
  root.style.setProperty('--sidebar-primary', primary)
  root.style.setProperty('--sidebar-ring', hexToRgba(hex, 0.4))
  root.style.setProperty('--brand-from', primary)
}

export function ColorPicker() {
  const [open, setOpen] = useState(false)
  const [color, setColor] = useState('#0ea5e9')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    applyColor(color)
  }, [color])

  const copy = () => {
    navigator.clipboard.writeText(color)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {open && (
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 w-64 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Primary Color</p>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
            >×</button>
          </div>

          {/* Color wheel */}
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="h-10 w-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
            />
            <div className="flex-1">
              <input
                type="text"
                value={color}
                onChange={e => {
                  const v = e.target.value
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v)
                }}
                className="w-full rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground font-mono"
              />
            </div>
          </div>

          {/* Preview swatch */}
          <div
            className="h-10 w-full rounded-xl shadow-md transition-all"
            style={{ background: `linear-gradient(to right, ${color}, #0070f3)` }}
          />

          {/* Presets */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Presets</p>
            <div className="grid grid-cols-5 gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.value}
                  title={p.label}
                  onClick={() => setColor(p.value)}
                  className="h-7 w-full rounded-lg border-2 transition-transform hover:scale-110 active:scale-95"
                  style={{
                    backgroundColor: p.value,
                    borderColor: color === p.value ? 'var(--foreground)' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Copy */}
          <button
            onClick={copy}
            className="w-full rounded-xl py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
            style={{ background: `linear-gradient(to right, ${color}, #0070f3)` }}
          >
            {copied ? '✓ Copied!' : `Copy ${color}`}
          </button>

          <p className="text-[10px] text-muted-foreground text-center">Dev tool — changes reset on reload</p>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Color picker"
        className="h-11 w-11 rounded-full shadow-xl border border-border flex items-center justify-center text-lg transition-transform hover:scale-110 active:scale-95"
        style={{ background: `linear-gradient(135deg, ${color}, #0070f3)` }}
      >
        🎨
      </button>
    </div>
  )
}
