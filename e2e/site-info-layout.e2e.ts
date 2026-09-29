import { expect, test } from '@playwright/test'

const navLabels = ['Privacy', 'Terms', 'About', 'Licenses'] as const

async function expectHeaderHasNoOverflow(page: import('@playwright/test').Page) {
  const nav = page.getByRole('navigation', { name: 'Site information' })

  for (const label of navLabels) {
    const link = nav.getByRole('link', { name: label, exact: true })
    await expect(link).toBeVisible()
    const textLineCount = await link.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return range.getClientRects().length
    })
    expect(textLineCount).toBe(1)
  }

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(horizontalOverflow).toBeLessThanOrEqual(1)
}

test('keeps site information header wrapping deterministic across responsive widths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await page.goto('/privacy/')
  await expectHeaderHasNoOverflow(page)

  const brand = page.getByRole('link', { name: 'DualView', exact: true })
  const nav = page.getByRole('navigation', { name: 'Site information' })
  const desktopBrandBox = await brand.boundingBox()
  const desktopNavBox = await nav.boundingBox()
  expect(desktopBrandBox).not.toBeNull()
  expect(desktopNavBox).not.toBeNull()
  expect(
    Math.abs(
      (desktopBrandBox?.y ?? 0) +
        (desktopBrandBox?.height ?? 0) / 2 -
        ((desktopNavBox?.y ?? 0) + (desktopNavBox?.height ?? 0) / 2),
    ),
  ).toBeLessThan(8)

  await page.setViewportSize({ width: 680, height: 900 })
  await page.reload()
  await expectHeaderHasNoOverflow(page)

  const stackedBrandBox = await brand.boundingBox()
  const stackedNavBox = await nav.boundingBox()
  expect(stackedBrandBox).not.toBeNull()
  expect(stackedNavBox).not.toBeNull()
  expect(stackedNavBox?.y ?? 0).toBeGreaterThanOrEqual(
    (stackedBrandBox?.y ?? 0) + (stackedBrandBox?.height ?? 0),
  )

  await page.setViewportSize({ width: 390, height: 900 })
  await page.reload()
  await expectHeaderHasNoOverflow(page)

  const boxes = await Promise.all(
    navLabels.map((label) => nav.getByRole('link', { name: label, exact: true }).boundingBox()),
  )
  for (const box of boxes) expect(box).not.toBeNull()
  expect(Math.abs((boxes[0]?.y ?? 0) - (boxes[1]?.y ?? 0))).toBeLessThan(2)
  expect(boxes[2]?.y ?? 0).toBeGreaterThan((boxes[0]?.y ?? 0) + (boxes[0]?.height ?? 0))
  expect(Math.abs((boxes[2]?.y ?? 0) - (boxes[3]?.y ?? 0))).toBeLessThan(2)
})
