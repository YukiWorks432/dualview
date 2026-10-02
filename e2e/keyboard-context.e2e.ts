import { expect, test, type Page } from '@playwright/test'

async function state(page: Page) {
  return page.evaluate(async () => {
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    const timeline = useTimelineStore.getState()
    return {
      clips: timeline.tracks.flatMap((track) => track.clips),
      selected: timeline.selectedClipIds,
      loop: timeline.loopRegion,
      mode: useProjectStore.getState().comparisonMode,
      scopes: useProjectStore.getState().scopesSettings.showScopes,
      playing: usePlaybackStore.getState().isPlaying,
    }
  })
}

async function focusBackground(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
}

async function seed(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForFunction(async () => {
    const { usePersistenceStore } = await import('/src/stores/persistenceStore.ts')
    return Boolean(usePersistenceStore.getState().currentProjectId)
  })
  await page.evaluate(async () => {
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const { useTimelineStore } = await import('/src/stores/timelineStore.ts')
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    const { useHistoryStore } = await import('/src/stores/historyStore.ts')
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 16
    const context = canvas.getContext('2d')!
    for (const [index, color] of ['red', 'blue'].entries()) {
      context.fillStyle = color
      context.fillRect(0, 0, 16, 16)
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!)))
      const media = await useMediaStore
        .getState()
        .addFile(new File([blob], `${color}.png`, { type: 'image/png' }))
      if (!media) throw new Error('検証用画像の取込が取り消されました')
      const clip = useTimelineStore
        .getState()
        .addClip(index === 0 ? 'track-a' : 'track-b', media.id, 0, 10)
      if (index === 0) useTimelineStore.getState().selectClip(clip.id)
    }
    usePlaybackStore.getState().seek(5)
    useHistoryStore.getState().clear()
  })
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  await focusBackground(page)
}

async function setLoop(page: Page) {
  await page.keyboard.press('i')
  await page.evaluate(async () => {
    const { usePlaybackStore } = await import('/src/stores/playbackStore.ts')
    usePlaybackStore.getState().seek(8)
  })
  await page.keyboard.press('o')
  expect((await state(page)).loop).not.toBeNull()
}

test('Audio QAのA/B/Sが音声だけを選び、修飾キー付き編集と通常Sを保持する', async ({ page }) => {
  await seed(page)
  await page.keyboard.press('Digit4')
  const audioA = page.getByRole('button', { name: 'A', exact: true })
  const audioB = page.getByRole('button', { name: 'B', exact: true })
  const both = page.getByRole('button', { name: 'A+B', exact: true })
  await expect(both).toHaveAttribute('aria-pressed', 'true')
  for (const [key, button] of [
    ['a', audioA],
    ['b', audioB],
    ['s', both],
  ] as const) {
    await page.keyboard.press(key)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTitle('Collapse Sidebar', { exact: true })).toBeVisible()
    await expect(page.locator('[data-clip]')).toHaveCount(2)
  }
  await page.keyboard.press('b')
  await page.keyboard.press('Control+a')
  expect((await state(page)).selected).toHaveLength(2)
  await expect(audioB).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Control+s')
  await expect(audioB).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Shift+s')
  await expect(audioB).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  await page.keyboard.press('Meta+a')
  await expect(audioB).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(page.locator('[data-clip]')).toHaveCount(3)
  await page.keyboard.press('Control+z')
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  await page.keyboard.press('Control+Shift+z')
  await expect(page.locator('[data-clip]')).toHaveCount(3)
  await page.keyboard.press('Meta+z')
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  await page.keyboard.press('Digit1')
  await page
    .locator('[data-clip]')
    .first()
    .click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('s')
  await expect(page.locator('[data-clip]')).toHaveCount(3)
  await page.keyboard.press('b')
  await expect(page.getByTitle('Open Sidebar (B)')).toBeVisible()
  await page.keyboard.press('b')
  await expect(page.getByTitle('Collapse Sidebar (B)')).toBeVisible()
  // 比較画面を繰り返し切り替えた後も、古い登録や二重登録を残さない。
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press('Digit4')
    await expect(both).toBeVisible()
    await page.keyboard.press('b')
    await expect(audioB).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('s')
    await expect(page.locator('[data-clip]')).toHaveCount(3)
    await page.keyboard.press('Digit1')
  }
  // 速度を選んだボタンに焦点が残っていても、Spaceは従来通り再生を所有する。
  const speed = page.getByRole('button', { name: '0.5×', exact: true })
  await speed.click()
  await expect(speed).toBeFocused()
  await page.keyboard.press('Space')
  expect((await state(page)).playing).toBe(true)
  await page.keyboard.press('Space')
  expect((await state(page)).playing).toBe(false)
})

test('入力欄と編集可能要素、IME変換から全体キーへ漏らさない', async ({ page }) => {
  await seed(page)
  const search = page.getByPlaceholder('Search files...')
  await search.fill('')
  await search.pressSequentially('bsnr1234?')
  await search.press('Space')
  await search.press('Alt+1')
  await expect(search).toHaveValue('bsnr1234? ')
  expect((await state(page)).mode).toBe('slider')
  expect((await state(page)).playing).toBe(false)
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  await expect(page.getByTitle('Collapse Sidebar (B)')).toBeVisible()

  // アプリ外の編集要素でも、実際のフォーカス先とキー伝播を検証する。
  for (const tag of ['textarea', 'contenteditable', 'select'] as const) {
    await page.evaluate((tag) => {
      const element = document.createElement(tag === 'contenteditable' ? 'div' : tag)
      element.id = 'keyboard-editing-fixture'
      element.style.cssText = 'position:fixed;top:0;left:0;z-index:100;width:200px;height:50px'
      if (tag === 'contenteditable') {
        element.contentEditable = 'true'
        element.innerHTML = '<span>edit</span>'
      }
      if (tag === 'select') element.innerHTML = '<option>first</option><option>second</option>'
      document.body.append(element)
      element.focus()
    }, tag)
    for (const key of ['b', 's', 'Digit4', 'Space', 'Delete', 'Alt+1', 'Control+a'])
      await page.keyboard.press(key)
    expect((await state(page)).mode).toBe('slider')
    expect((await state(page)).playing).toBe(false)
    await expect(page.locator('[data-clip]')).toHaveCount(2)
    await expect(page.getByTitle('Collapse Sidebar (B)')).toBeVisible()
    await page.locator('#keyboard-editing-fixture').evaluate((element) => element.remove())
  }
  await focusBackground(page)
  await page.evaluate(() =>
    document.body.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })),
  )
  for (const key of ['b', 's', 'Digit4', 'Space']) await page.keyboard.press(key)
  await page.evaluate(() =>
    document.body.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })),
  )
  // OS依存のIMEイベント属性だけを合成し、通常キーは上で実入力している。
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'b',
        code: 'KeyB',
        bubbles: true,
        cancelable: true,
        isComposing: true,
      }),
    )
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 's',
        code: 'KeyS',
        bubbles: true,
        cancelable: true,
        keyCode: 229,
      }),
    )
  })
  expect((await state(page)).mode).toBe('slider')
  expect((await state(page)).playing).toBe(false)
  await expect(page.locator('[data-clip]')).toHaveCount(2)
  await expect(page.getByTitle('Collapse Sidebar (B)')).toBeVisible()
  await page.keyboard.press('b')
  await expect(page.getByTitle('Open Sidebar (B)')).toBeVisible()
})

test('ヘルプとプロジェクトと書き出しのEscapeがループを保ちフォーカスを戻す', async ({ page }) => {
  await seed(page)
  await setLoop(page)
  const loop = (await state(page)).loop
  const shortcuts = page.getByRole('button', { name: 'Keyboard shortcuts', exact: true })
  for (const button of [
    shortcuts,
    page.getByTitle('Open Projects'),
    page.getByRole('button', { name: 'Export', exact: true }),
  ]) {
    await button.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (const key of ['Tab', 'Tab', 'Shift+Tab']) {
      await page.keyboard.press(key)
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
        true,
      )
    }
    await dialog.focus()
    for (const key of [
      'b',
      's',
      'Digit4',
      'Space',
      'Control+a',
      'Control+z',
      'Alt+1',
      'Shift+Slash',
    ])
      await page.keyboard.press(key)
    await expect(dialog).toBeVisible()
    expect((await state(page)).mode).toBe('slider')
    expect((await state(page)).playing).toBe(false)
    await expect(page.locator('[data-clip]')).toHaveCount(2)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(button).toBeFocused()
    expect((await state(page)).loop).toEqual(loop)
  }
  await shortcuts.click()
  await expect(page.getByRole('dialog').getByText('Audio QA only', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Split selected clip (outside Audio QA)', { exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await focusBackground(page)
  await page.locator('[data-clip]').first().click({ button: 'right' })
  const clipMenu = page.getByRole('button', { name: 'Split at Playhead S', exact: true })
  await expect(clipMenu).toBeVisible()
  await page.keyboard.press('Shift+Slash')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(clipMenu).toBeVisible()
  expect((await state(page)).loop).toEqual(loop)
  await page.keyboard.press('Escape')
  await expect(clipMenu).toHaveCount(0)
  expect((await state(page)).loop).toEqual(loop)
  await focusBackground(page)
  await page.keyboard.press('Escape')
  expect((await state(page)).loop).toBeNull()
})

test('URL取込と比較用ダイアログはフォーカス・入力値・入れ子のEscapeを保持する', async ({
  page,
}) => {
  await seed(page)
  await setLoop(page)
  const loop = (await state(page)).loop
  const urlButton = page.getByRole('button', { name: 'URL', exact: true }).first()
  await urlButton.click()
  const urlDialog = page.getByRole('dialog', { name: 'Import from URL' })
  await expect(urlDialog).toBeVisible()
  await urlDialog
    .getByPlaceholder('https://example.com/image.jpg')
    .fill('https://example.com/kept.png')
  await page.keyboard.press('Escape')
  await expect(urlDialog).toHaveCount(0)
  await expect(urlButton).toBeFocused()
  expect((await state(page)).loop).toEqual(loop)
  await urlButton.click()
  await expect(urlDialog.getByPlaceholder('https://example.com/image.jpg')).toHaveValue(
    'https://example.com/kept.png',
  )
  await page.keyboard.press('Escape')
  await focusBackground(page)
  await page.keyboard.press('Digit3')
  for (const title of ['Batch Comparison (WEBGL-013)', 'Custom Shader Editor (WEBGL-014)']) {
    const trigger = page.getByTitle(title)
    await trigger.click()
    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible()
    if (title.startsWith('Custom')) {
      const code = dialog.locator('textarea')
      await code.fill('// preserved editor content')
      const save = dialog.getByRole('button', { name: 'Save', exact: true })
      await save.click()
      const nested = page.getByRole('dialog', { name: 'Save Shader', exact: true })
      await expect(nested).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(nested).toHaveCount(0)
      await expect(save).toBeFocused()
      await expect(code).toHaveValue('// preserved editor content')
    }
    await dialog.getByRole('button').first().focus()
    await page.keyboard.press('g')
    await page.keyboard.press('s')
    await page.keyboard.press('Digit4')
    expect((await state(page)).mode).toBe('webgl-compare')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect((await state(page)).loop).toEqual(loop)
  }
  await page.getByTitle('Custom Shader Editor (WEBGL-014)').click()
  await expect(page.getByRole('dialog').locator('textarea')).toHaveValue(
    '// preserved editor content',
  )
})

test('モード固有G・Shift数字とAlt絞り込みは一つの操作だけを行う', async ({ page }) => {
  await seed(page)
  await page.keyboard.press('Alt+1')
  expect((await state(page)).mode).toBe('slider')
  await expect(page.getByText('No matching media')).toBeVisible()
  await page.keyboard.press('Alt+2')
  expect((await state(page)).mode).toBe('slider')
  await page.keyboard.press('Digit3')
  const gamut = page.getByTitle('Gamut Warning Overlay (SCOPE-010, G)')
  await expect(gamut).toBeVisible()
  const beforeClass = await gamut.getAttribute('class')
  const beforeScopes = (await state(page)).scopes
  await page.keyboard.press('g')
  await expect(gamut).not.toHaveAttribute('class', beforeClass!)
  expect((await state(page)).scopes).toBe(beforeScopes)
  await page.keyboard.press('g')
  await expect(gamut).toHaveAttribute('class', beforeClass!)
  await page.keyboard.press('Digit1')
  await page.keyboard.press('g')
  expect((await state(page)).scopes).toBe(!beforeScopes)
  await page.keyboard.press('g')
  await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/stores/projectStore.ts')
    const { useMediaStore } = await import('/src/stores/mediaStore.ts')
    const first = useMediaStore.getState().files[0].id
    useProjectStore.getState().setQuadViewSettings({ sources: [first, first, first, first] })
    useProjectStore.getState().setComparisonMode('quad')
  })
  await expect(page.getByRole('img', { name: 'Quadrant 1', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /^Quadrant [1-4]$/ })).toHaveCount(4)
  const sources = await page.evaluate(
    async () =>
      (await import('/src/stores/projectStore.ts')).useProjectStore.getState().quadViewSettings
        .sources,
  )
  await page.keyboard.press('Shift+Digit1')
  expect((await state(page)).mode).toBe('quad')
  const changed = await page.evaluate(
    async () =>
      (await import('/src/stores/projectStore.ts')).useProjectStore.getState().quadViewSettings
        .sources,
  )
  expect(changed[0]).not.toBe(sources[0])
  expect(changed.slice(1)).toEqual(sources.slice(1))
  await page.keyboard.press('Digit2')
  expect((await state(page)).mode).toBe('side-by-side')
})

test('検索欄に焦点を残したドラッグをEscapeで取り消し、位置と入力とループを保つ', async ({
  page,
}) => {
  await seed(page)
  await setLoop(page)
  const before = await state(page)
  const search = page.getByPlaceholder('Search files...')
  await search.fill('red')
  const clip = page.locator('[data-clip]').first()
  const original = await clip.boundingBox()
  if (!original) throw new Error('ドラッグ対象のクリップが表示されていません')
  await page.mouse.move(original.x + 20, original.y + 20)
  await page.mouse.down()
  await page.mouse.move(original.x + 140, original.y + 20, { steps: 5 })
  await expect(search).toBeFocused()
  // 位置が動くまで待ち、開始済みのドラッグを実際のEscapeとmouseupで取り消す。
  await expect
    .poll(async () => (await clip.boundingBox())?.x ?? -1)
    .toBeGreaterThan(original.x + 50)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect((await state(page)).clips).toEqual(before.clips)
  await expect.poll(async () => (await clip.boundingBox())?.x ?? -1).toBeCloseTo(original.x, 0)
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('red')
  expect((await state(page)).loop).toEqual(before.loop)
  // 操作を取り消した後のEscapeは入力欄に留まり、ループ解除へ漏れない。
  await page.keyboard.press('Escape')
  expect((await state(page)).loop).toEqual(before.loop)
})

test('検索欄に焦点を残したクリップメニューのEscapeは入力とループを保つ', async ({ page }) => {
  await seed(page)
  await setLoop(page)
  const before = await state(page)
  const search = page.getByPlaceholder('Search files...')
  await search.fill('red')
  await page
    .locator('[data-clip]')
    .first()
    .click({ button: 'right', position: { x: 20, y: 20 } })
  const menu = page.getByRole('button', { name: 'Split at Playhead S', exact: true })
  await expect(menu).toBeVisible()
  await expect(search).toBeFocused()
  // 変換中は、開始済みの操作よりIMEがEscapeを所有する。
  await search.evaluate((element) =>
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })),
  )
  await page.keyboard.press('Escape')
  await expect(menu).toBeVisible()
  await search.evaluate((element) =>
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })),
  )
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('red')
  expect((await state(page)).clips).toEqual(before.clips)
  expect((await state(page)).loop).toEqual(before.loop)
})

test('狭幅ドロワーのAlt絞り込みは表示中の素材一覧だけを変更する', async ({ page }) => {
  await seed(page)
  await page.setViewportSize({ width: 768, height: 900 })
  await expect(page.getByPlaceholder('Search files...')).toBeHidden()
  await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click()
  const library = page.getByRole('complementary')
  await expect(library.getByPlaceholder('Search files...')).toBeVisible()
  await expect(library.getByText('red.png', { exact: true })).toBeVisible()
  await expect(library.getByText('blue.png', { exact: true })).toBeVisible()
  await page.keyboard.press('Alt+1')
  await expect(library.getByText('No matching media', { exact: true })).toBeVisible()
  await expect(library.getByText('red.png', { exact: true })).toHaveCount(0)
  await expect(library.getByText('blue.png', { exact: true })).toHaveCount(0)
  await page.keyboard.press('Alt+2')
  await expect(library.getByText('No matching media', { exact: true })).toHaveCount(0)
  await expect(library.getByText('red.png', { exact: true })).toBeVisible()
  await expect(library.getByText('blue.png', { exact: true })).toBeVisible()
  expect((await state(page)).mode).toBe('slider')
  // ドロワーの操作が、裏で残るデスクトップ一覧の絞り込みを変更していない。
  await page.keyboard.press('Alt+1')
  await expect(library.getByText('No matching media', { exact: true })).toBeVisible()
  await library.getByTitle('Close Sidebar', { exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(library.getByText('No matching media', { exact: true })).toHaveCount(0)
  await expect(library.getByText('red.png', { exact: true })).toBeVisible()
  await expect(library.getByText('blue.png', { exact: true })).toBeVisible()
})
