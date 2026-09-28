import { test, expect } from '@playwright/test'

async function join(page, url, name) {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push('native dialog: ' + d.message()); d.dismiss() })
  await page.goto(url)
  await page.waitForSelector('.nav-item')
  const nameInput = page.getByLabel('Display name')
  if (await nameInput.waitFor({ timeout: 1500 }).then(() => true, () => false)) {
    await nameInput.fill(name)
    await page.click('.dialog .btn.primary')
  }
  return errors
}

test('fresh visitors get a private random room', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await join(a, '/', 'Ana')
  await join(b, '/', 'Bo')
  const ha = new URL(a.url()).hash, hb = new URL(b.url()).hash
  expect(ha).toMatch(/^#[A-Za-z0-9_-]{22}$/)
  expect(ha).not.toBe(hb)
})

test('two tabs converge on prompts, prose, and survive reload', async ({ context }) => {
  const a = await context.newPage()
  const errors = await join(a, '/', 'Ana')
  const url = a.url()
  const b = await context.newPage()
  errors.push(...await join(b, url, 'Ana'))

  await a.click('[data-tab=prompts]')
  await a.click('text=Deal prompts')
  await expect(a.locator('.prompt')).toHaveCount(12)
  await a.locator('.prompt textarea.a').first().fill('A lighthouse keeper who lies.')

  await b.click('[data-tab=prompts]')
  await b.click('.segmented button[data-f=all]')
  await expect(b.locator('.prompt textarea.a').first()).toHaveValue('A lighthouse keeper who lies.')

  await a.click('[data-tab=write]')
  await a.fill('.draft', 'The lamp went dark at midnight.')
  await a.click('text=Add passage')
  await b.click('[data-tab=write]')
  await expect(b.locator('.prose')).toContainText('The lamp went dark at midnight.')

  // concurrent typing converges
  await a.locator('.prose p').first().click(); await a.keyboard.press('End')
  await b.locator('.prose p').first().click(); await b.keyboard.press('Home')
  await Promise.all([a.keyboard.type(' Waves.'), b.keyboard.type('Night. ')])
  const text = p => p.locator('.prose p').first().evaluate(el => {
    const clone = el.cloneNode(true)
    clone.querySelectorAll('.remote-caret').forEach(c => c.remove())
    return clone.textContent.replace(/⁠/g, '')
  })
  await expect.poll(async () => (await text(a)) === (await text(b))).toBe(true)
  expect(await text(a)).toContain('Waves.')
  expect(await text(a)).toContain('Night.')

  await b.reload()
  await b.click('[data-tab=write]')
  await expect(b.locator('.prose')).toContainText('The lamp went dark')
  expect(errors).toEqual([])
})

test('hostile content renders inert', async ({ context }) => {
  const a = await context.newPage()
  const errors = await join(a, '/', '<img src=x onerror=alert(1)>')
  const payloads = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '"><svg/onload=alert(1)>', 'javascript:alert(1)']
  await a.fill('.title-input', payloads.join(' '))
  await a.click('[data-tab=prompts]')
  await a.click('text=Deal prompts')
  await a.locator('.prompt textarea.a').first().fill(payloads.join(' '))
  await a.click('[data-tab=bible]')
  await a.click('[data-tab=write]')
  await a.fill('.draft', payloads.join(' '))
  await a.click('text=Add passage')
  await a.click('[data-tab=overview]')
  await expect(a.locator('img[src=x], svg[onload], script:not([type])')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('plot catalog offers 300 lines and changing plot keeps prose', async ({ context }) => {
  const a = await context.newPage()
  await join(a, '/', 'Ana')
  await a.click('[data-tab=write]')
  await a.fill('.draft', 'First line of prose.')
  await a.click('text=Add passage')
  await a.click('[data-tab=plot]')
  await expect(a.locator('.plot-results option')).toHaveCount(300)
  await a.click('text=Randomize new')
  await expect(a.locator('.beat')).toHaveCount(12)
  await expect(a.locator('.beat .campbell-chip').first()).toBeVisible()
  await a.click('[data-tab=write]')
  await expect(a.locator('.prose')).toContainText('First line of prose.')
})

// Real internet P2P between isolated profiles via public Nostr relays. Opt-in: it depends on
// third-party relays and network conditions. Run with P2P=1 npm run test:e2e
test('isolated browsers sync over WebRTC', async ({ browser }) => {
  test.skip(!process.env.P2P, 'set P2P=1 to run')
  test.setTimeout(120_000)
  const a = await (await browser.newContext()).newPage()
  await join(a, '/', 'Ana')
  const b = await (await browser.newContext()).newPage()
  await join(b, a.url(), 'Bo')
  await a.fill('.title-input', 'Over the wire')
  await expect(b.locator('.title-input')).toHaveValue('Over the wire', { timeout: 90_000 })
})
