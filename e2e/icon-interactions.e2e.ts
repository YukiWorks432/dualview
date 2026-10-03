import { expect, test } from '@playwright/test'

for (const kind of ['icon', 'labeled', 'legacy'] as const) {
  test(`${kind} button scales only its icon on hover without replacing its transform`, async ({
    page,
  }) => {
    await page.goto('/')
    // Mount the real adapters with the app's real stylesheet, independently of toolbar state.
    await page.evaluate(async (kind) => {
      const { mountHoverButton } = await import('/e2e/iconHoverFixture.tsx')
      mountHoverButton(kind)
    }, kind)

    const button = page.getByRole('button', { name: 'Hover contract', exact: true })
    const icon = page.getByTestId('hover-icon')
    const scaled = kind === 'legacy' ? icon : button.locator('[data-slot$="-icon"]')
    const label = page.getByTestId('hover-label')
    await expect(button).toBeVisible()
    await page.mouse.move(0, 0)
    const buttonBefore = await button.boundingBox()
    const iconBefore = await icon.boundingBox()
    const transformBefore = await icon.evaluate((element) => getComputedStyle(element).transform)
    const labelBefore = kind === 'icon' ? null : await label.boundingBox()
    expect(iconBefore).not.toBeNull()
    expect(transformBefore).not.toBe('none')
    await expect(scaled).toHaveCSS('transition-duration', '0.15s')
    await expect(scaled).toHaveCSS(
      'transition-timing-function',
      kind === 'legacy' ? 'ease-out' : 'cubic-bezier(0, 0, 0.2, 1)',
    )

    await button.hover()
    await expect
      .poll(async () => (await icon.boundingBox())!.width / iconBefore!.width)
      .toBeCloseTo(1.25, 2)
    expect(await button.boundingBox()).toEqual(buttonBefore)
    expect(await icon.evaluate((element) => getComputedStyle(element).transform)).toBe(
      transformBefore,
    )
    if (labelBefore) expect(await label.boundingBox()).toEqual(labelBefore)

    await page.mouse.move(0, 0)
    await expect
      .poll(async () => (await icon.boundingBox())!.width / iconBefore!.width)
      .toBeCloseTo(1, 2)
  })
}
