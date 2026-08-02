type OrionIconName =
  | 'bell'
  | 'chevron'
  | 'command'
  | 'compass'
  | 'council'
  | 'mic'
  | 'mic-off'
  | 'panel'
  | 'plus'
  | 'search'
  | 'settings'
  | 'spark'
  | 'trash'
  | 'x'

type OrionIconProps = {
  name: OrionIconName
  size?: number
  className?: string
}

function IconDrawing({ name }: { name: OrionIconName }) {
  switch (name) {
    case 'bell':
      return <><path d="M7 16.5h10l-1.4-2.1V10a3.6 3.6 0 0 0-7.2 0v4.4L7 16.5Z" /><path d="M10.5 19h3" /><circle cx="12" cy="5.2" r=".8" /></>
    case 'chevron':
      return <path d="m7 9.5 5 5 5-5" />
    case 'command':
      return <><path d="M8 4.5v15M16 4.5v15M4.5 8h15M4.5 16h15" /><circle cx="8" cy="8" r="3.5" /><circle cx="16" cy="8" r="3.5" /><circle cx="8" cy="16" r="3.5" /><circle cx="16" cy="16" r="3.5" /></>
    case 'compass':
      return <><circle cx="12" cy="12" r="8" /><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" /><circle cx="12" cy="12" r=".7" /></>
    case 'council':
      return <><path d="M7 9.5 12 6l5 3.5v6L12 19l-5-3.5v-6Z" /><circle cx="7" cy="9.5" r="1.6" /><circle cx="12" cy="6" r="1.6" /><circle cx="17" cy="9.5" r="1.6" /><circle cx="12" cy="19" r="1.6" /></>
    case 'mic':
      return <><rect x="9" y="4" width="6" height="11" rx="3" /><path d="M6.5 12.5a5.5 5.5 0 0 0 11 0M12 18v2.5M9 20.5h6" /></>
    case 'mic-off':
      return <><path d="M9 8V7a3 3 0 0 1 5.8-1.1M15 10.2V12a3 3 0 0 1-4.7 2.5M6.5 12.5a5.5 5.5 0 0 0 9.7 3.6M17.5 12.5a5.5 5.5 0 0 1-.2 1.4M12 18v2.5M9 20.5h6M4 4l16 16" /></>
    case 'panel':
      return <><rect x="4" y="5" width="16" height="14" rx="1.5" /><path d="M15 5v14M17.5 8v8" /></>
    case 'plus':
      return <path d="M12 5v14M5 12h14" />
    case 'search':
      return <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 4.5 4.5" /></>
    case 'settings':
      return <><path d="M5 7h5M14 7h5M5 12h9M18 12h1M5 17h2M11 17h8" /><circle cx="12" cy="7" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="9" cy="17" r="2" /></>
    case 'spark':
      return <><path d="M12 3.5 13.4 9l5.1 1.5-5.1 1.5-1.4 5.5-1.4-5.5-5.1-1.5L10.6 9 12 3.5Z" /><path d="m18 15 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" /></>
    case 'trash':
      return <><path d="M7 8h10l-.7 11h-8.6L7 8ZM9 8V5.5h6V8M5.5 8h13M10 11v5M14 11v5" /></>
    case 'x':
      return <path d="m6 6 12 12M18 6 6 18" />
  }
}

export function OrionIcon({ name, size = 18, className }: OrionIconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <IconDrawing name={name} />
    </svg>
  )
}
