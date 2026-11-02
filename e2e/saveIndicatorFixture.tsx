import { createRoot, type Root } from 'react-dom/client'

import { SaveIndicator } from '../src/components/project/SaveIndicator'

let root: Root | undefined
let host: HTMLDivElement | undefined

export function mountSaveIndicator() {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  root.render(<SaveIndicator />)
}

export function unmountSaveIndicator() {
  root?.unmount()
  host?.remove()
}
