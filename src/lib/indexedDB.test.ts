import { describe, expect, it } from 'vitest'

import { shouldDeleteProjectMediaBlob } from './indexedDB'

describe('project media retention', () => {
  const retainedMediaIds = new Set(['kept-media'])

  it('removes media that is no longer referenced by the same project', () => {
    expect(
      shouldDeleteProjectMediaBlob(
        { projectId: 'project-a', mediaId: 'removed-media' },
        'project-a',
        retainedMediaIds,
      ),
    ).toBe(true)
  })

  it('keeps retained media and never selects another project for deletion', () => {
    expect(
      shouldDeleteProjectMediaBlob(
        { projectId: 'project-a', mediaId: 'kept-media' },
        'project-a',
        retainedMediaIds,
      ),
    ).toBe(false)
    expect(
      shouldDeleteProjectMediaBlob(
        { projectId: 'project-b', mediaId: 'removed-media' },
        'project-a',
        retainedMediaIds,
      ),
    ).toBe(false)
  })
})
