import { expect, test, type Locator, type Page } from '@playwright/test'

async function openSettings(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
}

function filterTrigger(page: Page) {
  return page.getByRole('button', { name: /^Small-region filter/ })
}

function qualityTrigger(page: Page) {
  return page.getByRole('button', { name: /^Analysis quality/ })
}

// Composite CSS colors in the browser so translucent selected/hover backgrounds
// and modern color() serialization are measured against the actual popup surface.
async function expectReadableItems(menu: Locator) {
  const items = menu.getByRole('menuitemradio')
  let selectedBackground = 0
  for (const item of await items.all()) {
    const contrast = await item.evaluate((element) => {
      const popup = element.closest('[role="menu"]')!
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')!
      const paint = (color: string) => {
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
      }
      const luminance = () => {
        const [red, green, blue] = Array.from(context.getImageData(0, 0, 1, 1).data)
          .slice(0, 3)
          .map((channel) => {
            const value = channel / 255
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
          })
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
      paint(getComputedStyle(popup).backgroundColor)
      const opaquePopup = context.getImageData(0, 0, 1, 1).data[3] === 255
      paint(getComputedStyle(element).backgroundColor)
      const background = luminance()
      const backgroundPixel = context.getImageData(0, 0, 1, 1)
      const ratio = (color: string) => {
        context.putImageData(backgroundPixel, 0, 0)
        paint(color)
        const foreground = luminance()
        return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)
      }
      const indicator = element.querySelector('svg')
      return {
        opaquePopup,
        background,
        label: ratio(getComputedStyle(element).color),
        indicator: indicator ? ratio(getComputedStyle(indicator).stroke) : null,
      }
    })
    expect(contrast.opaquePopup).toBe(true)
    expect(contrast.label, await item.innerText()).toBeGreaterThanOrEqual(4.5)
    if ((await item.getAttribute('aria-checked')) === 'true') {
      selectedBackground = contrast.background
      await expect(item.locator('svg')).toBeVisible()
      expect(contrast.indicator).not.toBeNull()
      expect(contrast.indicator!).toBeGreaterThanOrEqual(3)
    }
  }
  return selectedBackground
}

// The app currently has one dark palette; it must stay readable under either
// operating-system preference rather than testing a nonexistent light theme.
for (const colorScheme of ['dark', 'light'] as const) {
  test(`keeps selected and unselected options readable with ${colorScheme} preference`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme })
    await openSettings(page)
    for (const trigger of [filterTrigger(page), qualityTrigger(page)]) {
      await trigger.click()
      const menu = page.getByRole('menu')
      const checked = menu.getByRole('menuitemradio', { checked: true })
      const unchecked = menu.getByRole('menuitemradio', { checked: false }).first()
      await expect(checked).toHaveCount(1)
      await unchecked.hover()
      const resting = await expectReadableItems(menu)
      await checked.hover()
      const hovered = await expectReadableItems(menu)
      expect(hovered, 'Selected option must brighten on hover').toBeGreaterThan(resting)
      await unchecked.hover()
      await expectReadableItems(menu)
      await unchecked.click()
      await trigger.click()
      await expectReadableItems(menu)
      await page.keyboard.press('Escape')
    }
  })
}

test('uses readable shared menus for orientation and every Quick Export selector', async ({
  page,
}) => {
  await openSettings(page)
  for (const [label, option] of [
    ['Orientation', 'Horizontal (Top/Bottom)'],
    ['Format', 'GIF'],
    ['Quality', 'Low'],
    ['Resolution', '4K (Ultra HD)'],
  ]) {
    const trigger = page.getByRole('button', { name: new RegExp(`^${label} `) })
    await trigger.click()
    const menu = page.getByRole('menu')
    await expectReadableItems(menu)
    await menu.getByRole('menuitemradio', { name: option, exact: true }).click()
    await expect(trigger).toContainText(option)
    await expect(trigger).toBeFocused()
    await trigger.press('Enter')
    await expect(menu.getByRole('menuitemradio', { name: option, exact: true })).toBeChecked()
    await expectReadableItems(menu)
    await page.keyboard.press('Escape')
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Resolution / })).toContainText('4K (Ultra HD)')
  await expect(page.locator('select')).toHaveCount(0)
})

test('preserves source and numeric scope settings through shared menus', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTitle('Export (E)')).toBeVisible()
  await page.keyboard.press('g')
  const source = page.getByRole('button', { name: 'Scope source', exact: true })
  await source.click()
  await page.getByRole('menuitemradio', { name: 'Source B', exact: true }).click()
  await expect(source).toContainText('Source B')
  await page.getByTitle('Settings', { exact: true }).click()
  const zoom = page.getByRole('button', { name: 'V-Scope Zoom', exact: true })
  await zoom.click()
  await page.getByRole('menuitemradio', { name: '3x', exact: true }).click()
  await expect(zoom).toContainText('3x')
  await page.getByTitle('Close Scopes').click()
  await page.keyboard.press('g')
  await expect(source).toContainText('Source B')
  await expect(zoom).toContainText('3x')
})

test('keeps an export-dialog select accessible above its modal surface', async ({ page }) => {
  await page.goto('/')
  await page.getByTitle('Export (E)').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Image', exact: true }).click()
  const format = dialog.getByRole('button', { name: /^Format / })
  await format.click()
  const menu = page.getByRole('menu')
  await expectReadableItems(menu)
  await menu.getByRole('menuitemradio', { name: 'JPEG (smaller file)', exact: true }).click()
  await expect(format).toContainText('JPEG')
  await expect(dialog.getByRole('slider', { name: /Quality/ })).toBeVisible()
  await format.press('Enter')
  await expect(
    menu.getByRole('menuitemradio', { name: 'JPEG (smaller file)', exact: true }),
  ).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(format).toBeFocused()
})

test('selects filter and quality values, preserving them when reopened', async ({
  page,
}, testInfo) => {
  await openSettings(page)
  const filter = filterTrigger(page)
  await expect(filter).toContainText('Low')
  await filter.click()
  await expect(page.getByRole('menuitemradio', { name: 'Low', exact: true })).toBeChecked()
  await page.screenshot({ path: testInfo.outputPath('difference-settings-dark.png') })
  await page.getByRole('menuitemradio', { name: 'High', exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(filter).toContainText('High')
  await expect(filter).toBeFocused()
  await filter.click()
  await expect(page.getByRole('menuitemradio', { name: 'High', exact: true })).toBeChecked()
  await page.keyboard.press('Escape')

  const quality = qualityTrigger(page)
  await quality.click()
  await page.getByRole('menuitemradio', { name: 'Full common resolution' }).click()
  await expect(quality).toContainText('Full common resolution')
  await quality.click()
  await expect(page.getByRole('menuitemradio', { name: 'Full common resolution' })).toBeChecked()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(filter).toContainText('High')
  await expect(quality).toContainText('Full common resolution')
})

test('supports keyboard selection and dismissal without application shortcuts', async ({
  page,
}) => {
  await openSettings(page)
  const filter = filterTrigger(page)
  await filter.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Home')
  await expect(page.getByRole('menuitemradio', { name: 'Off', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitemradio', { name: 'Low', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitemradio', { name: 'Medium', exact: true })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(filter).toContainText('Medium')
  await expect(filter).toBeFocused()
  await expect(page.getByTitle('Toggle playback (Space)')).toContainText('Play')

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('h')
  await expect(page.getByRole('menuitemradio', { name: 'High', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(filter).toContainText('High')
  await expect(filter).toBeFocused()

  const selectedMode = page.getByRole('tab', { selected: true })
  const modeName = await selectedMode.getAttribute('aria-label')
  await filter.click()
  await page.keyboard.press('Digit2')
  await expect(selectedMode).toHaveAttribute('aria-label', modeName!)
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(filter).toBeFocused()
  await expect(filter).toContainText('High')
})

test('dismisses with Tab and an outside click, then opens again', async ({ page }) => {
  await openSettings(page)
  const filter = filterTrigger(page)
  await filter.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(qualityTrigger(page)).toBeFocused()
  await filter.click()
  await expect(page.getByRole('menu')).toBeVisible()
  const outside = await page
    .getByRole('heading', { name: 'DualView', exact: true, includeHidden: true })
    .boundingBox()
  expect(outside).not.toBeNull()
  await page.mouse.click(outside!.x + outside!.width / 2, outside!.y + outside!.height / 2)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(filter).toContainText('Low')
  await filter.click()
  await expect(page.getByRole('menu')).toBeVisible()
})

test('keeps the popup reachable in a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 360 })
  await openSettings(page)
  const filter = filterTrigger(page)
  await filter.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const appearance = await menu.evaluate((element) => {
    const style = getComputedStyle(element)
    const bounds = element.getBoundingClientRect()
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      width: bounds.width,
      viewportHeight: window.innerHeight,
      overflow: style.overflowY,
    }
  })
  expect(appearance.top).toBeGreaterThanOrEqual(0)
  expect(appearance.bottom).toBeLessThanOrEqual(appearance.viewportHeight)
  expect(appearance.overflow).toBe('auto')
  expect(appearance.width).toBeCloseTo((await filter.boundingBox())!.width, 0)
  await page.keyboard.press('End')
  await expect(page.getByRole('menuitemradio', { name: 'High', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(filter).toContainText('High')
})
