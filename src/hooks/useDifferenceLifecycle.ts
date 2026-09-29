import { useEffect } from 'react'

import { createDifferenceRequest } from '../lib/difference/request'
import { useDifferenceStore } from '../stores/differenceStore'
import { useMediaStore } from '../stores/mediaStore'
import { usePersistenceStore } from '../stores/persistenceStore'
import { useTimelineStore } from '../stores/timelineStore'

/** Installed once by App so hiding the timeline or changing comparison mode does not cancel a job. */
export function useDifferenceLifecycle(): void {
  useEffect(() => {
    const check = () => {
      const state = useDifferenceStore.getState()
      if (state.key !== null && state.key !== createDifferenceRequest().key) state.invalidate()
    }
    const unsubscribeTimeline = useTimelineStore.subscribe((state, previous) => {
      if (state.tracks !== previous.tracks || state.duration !== previous.duration) check()
    })
    const unsubscribeMedia = useMediaStore.subscribe((state, previous) => {
      if (state.files !== previous.files) check()
    })
    const unsubscribeProject = usePersistenceStore.subscribe((state, previous) => {
      if (state.currentProjectId !== previous.currentProjectId) check()
    })
    check()
    return () => {
      unsubscribeTimeline()
      unsubscribeMedia()
      unsubscribeProject()
      useDifferenceStore.getState().cancel()
    }
  }, [])
}
