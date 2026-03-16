interface Props {
  adminName: string | null | undefined
}

export function PublicFooter({ adminName }: Props) {
  return (
    <footer className="bg-[#0c0c0c] border-t border-white/10 py-6 px-4 text-center">
      <p className="text-gray-500 text-sm">
        © {new Date().getFullYear()}{' '}
        {adminName ? `${adminName} Photography` : 'Photography'}
      </p>
      <a
        href="/client/login"
        className="text-xs text-gray-600 hover:text-gray-400 mt-1 inline-block"
      >
        Client Login
      </a>
    </footer>
  )
}
