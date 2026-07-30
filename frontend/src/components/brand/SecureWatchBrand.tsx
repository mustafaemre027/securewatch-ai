export interface SecureWatchBrandProps {
  variant?: 'logo' | 'mark'
  className?: string
  alt?: string
  ariaHidden?: boolean
}

export function SecureWatchBrand({
  variant = 'logo',
  className = '',
  alt,
  ariaHidden = false,
}: SecureWatchBrandProps) {
  const isLogo = variant === 'logo'
  const src = isLogo
    ? '/brand/securewatch-ai-logo.svg'
    : '/brand/securewatch-ai-mark.svg'

  const defaultAlt = isLogo ? 'SecureWatch AI Logo' : 'SecureWatch AI Icon'
  const resolvedAlt = ariaHidden ? '' : alt ?? defaultAlt

  return (
    <img
      src={src}
      alt={resolvedAlt}
      aria-hidden={ariaHidden || undefined}
      className={className}
    />
  )
}

export default SecureWatchBrand
