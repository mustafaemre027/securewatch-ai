export interface SecureWatchBrandProps {
  variant?: 'dark' | 'light'
  compact?: boolean
  className?: string
  eager?: boolean
  alt?: string
  ariaHidden?: boolean
}

export function SecureWatchBrand({
  variant = 'dark',
  compact = false,
  className = '',
  eager = false,
  alt,
  ariaHidden = false,
}: SecureWatchBrandProps) {
  let src: string
  if (compact) {
    src = variant === 'dark' ? '/brand/securewatch-ai-mark-dark.png' : '/brand/securewatch-ai-mark-light.png'
  } else {
    src = variant === 'dark' ? '/brand/securewatch-ai-logo-dark.png' : '/brand/securewatch-ai-logo-light.png'
  }

  // Use provided alt, otherwise fallback based on context.
  // If ariaHidden is true, alt should be empty.
  const resolvedAlt = ariaHidden ? '' : (alt !== undefined ? alt : 'SecureWatch AI')

  return (
    <img
      src={src}
      alt={resolvedAlt}
      aria-hidden={ariaHidden || undefined}
      className={className}
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      style={{
        maxWidth: '100%',
        height: 'auto',
        objectFit: 'contain'
      }}
    />
  )
}

export default SecureWatchBrand
