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
  let imgWidth: number
  let imgHeight: number

  if (compact) {
    src = variant === 'dark' ? '/brand/securewatch-ai-mark-dark.png' : '/brand/securewatch-ai-mark-light.png'
    imgWidth = variant === 'dark' ? 256 : 185
    imgHeight = variant === 'dark' ? 256 : 210
  } else {
    src = variant === 'dark' ? '/brand/securewatch-ai-logo-dark.png' : '/brand/securewatch-ai-logo-light.png'
    imgWidth = variant === 'dark' ? 915 : 960
    imgHeight = variant === 'dark' ? 245 : 225
  }

  // Use provided alt, otherwise fallback based on context.
  // If ariaHidden is true, alt should be empty.
  const resolvedAlt = ariaHidden ? '' : (alt !== undefined ? alt : 'SecureWatch AI')

  return (
    <img
      src={src}
      alt={resolvedAlt}
      aria-hidden={ariaHidden || undefined}
      width={imgWidth}
      height={imgHeight}
      className={`block w-auto max-w-full object-contain select-none ${className}`.trim()}
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
    />
  )
}

export default SecureWatchBrand
