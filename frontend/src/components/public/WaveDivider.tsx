interface Props {
  fromColor: string
  toColor: string
  direction: 'down' | 'up'
}

export function WaveDivider({ fromColor, toColor, direction }: Props) {
  const path =
    direction === 'down'
      ? 'M0,0 C480,60 960,60 1440,0 L1440,60 L0,60 Z'
      : 'M0,60 C480,0 960,0 1440,60 L1440,60 L0,60 Z'

  return (
    <svg
      viewBox="0 0 1440 60"
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', background: fromColor }}
      aria-hidden="true"
    >
      <path d={path} fill={toColor} />
    </svg>
  )
}
