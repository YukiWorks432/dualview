import { createRoot } from 'react-dom/client'

import { Button } from '../src/components/ui/button'
import { ButtonWithIcon } from '../src/components/ui/button-with-icon'
import { IconButton } from '../src/components/ui/icon-button'

export function mountHoverButton(kind: 'icon' | 'labeled' | 'legacy') {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:100px;top:100px;z-index:99999'
  document.body.append(host)
  const icon = (
    <svg width={16} height={16} style={{ transform: 'rotate(30deg)' }} data-testid="hover-icon">
      <path d="M2 2H14V14H2Z" />
    </svg>
  )
  const label = <span data-testid="hover-label">{kind === 'legacy' ? '3' : 'Export'}</span>
  createRoot(host).render(
    kind === 'icon' ? (
      <IconButton aria-label="Hover contract">{icon}</IconButton>
    ) : kind === 'labeled' ? (
      <ButtonWithIcon aria-label="Hover contract" icon={icon}>
        {label}
      </ButtonWithIcon>
    ) : (
      <Button aria-label="Hover contract">
        {icon}
        {label}
      </Button>
    ),
  )
}
