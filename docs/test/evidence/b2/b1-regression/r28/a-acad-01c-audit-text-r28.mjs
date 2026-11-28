// ACAD-01c follow-up (28 Nov, r28b): the whole text of a04's audit and dashboard pages, to find where the five conditions
// OmniCourse does not check are shown after #214. Prints page text only (synthetic account, completion fixture).
import { launch, newPage, BASE, email, screenSignIn, mainText } from '../a-lib.mjs';
const browser = await launch();
const page = await newPage(browser);
await screenSignIn(page, email('04'));
for (const route of ['/audit', '/dashboard']) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const text = await mainText(page);
  console.log(`${route} text (${text.length} chars):`, text);
  console.log(`${route} conditions-not-checked block:`, JSON.stringify(await page.locator('[data-test="conditions-not-checked"]').innerText().catch(() => null)));
  console.log(`${route} lines naming conditions not checked:`, JSON.stringify(text.split(' | ').filter((l) => /không kiểm tra|chưa kiểm tra|phòng đào tạo|điều kiện/i.test(l))));
}
await browser.close();
