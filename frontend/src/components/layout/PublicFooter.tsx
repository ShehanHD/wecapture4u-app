interface Props {
  adminName: string | null | undefined
}

export function PublicFooter({ adminName }: Props) {
  return (
    <footer className="py-10" style={{ background: '#F5F5F7', borderTop: '1px solid #E8E8ED' }}>
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: '#1D1D1F' }}>
          {adminName ? `${adminName} Photography` : 'weCapture4U'}
        </span>
        <span className="text-xs" style={{ color: '#AEAEB2' }}>
          © {new Date().getFullYear()} All rights reserved.
        </span>
        <a
          href="/client/login"
          className="text-sm transition-colors duration-150"
          style={{ color: '#6E6E73' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#1D1D1F')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6E6E73')}
        >
          Client Login
        </a>
      </div>
    </footer>
  )
}
