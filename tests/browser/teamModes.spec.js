import { test, expect } from '@playwright/test';
import { fixture } from '../fixtures.mjs';

test.beforeEach(async ({ page }) => {
  const data = fixture();
  data.members.push(...Array.from({ length: 4 }, (_, i) => ({ ...data.members[0], id: `extra-${i}`, name: `Extra ${i}` })));
  data.events = [{ id: 'event', name: 'Giải đội 2027', date: '2027-01-01', description: '', isLocked: false }];
  data.matches = []; data.draws = {};
  await page.addInitScript(data => {
    localStorage.setItem('pickleball_state_v2_3', JSON.stringify({ data, generation: 'team-test', baseRevision: 0, acknowledged: true, pending: false }));
  }, data);
  await page.route(/^https:/, route => route.abort());
});

const openSetup = async (page, mode) => {
  await page.goto('http://127.0.0.1:4177/#draw');
  await expect(page.getByText('Chế độ thử trên máy — không kết nối dữ liệu CLB.')).toBeVisible();
  await page.getByRole('button', { name: mode }).click();
  await page.getByRole('button', { name: 'Chọn tất cả' }).click();
  await page.getByRole('button', { name: /Bắt Đầu Bốc Thăm/ }).click();
  await expect(page.getByText('Bảng điểm đội')).toBeVisible();
};
const scoreFirst = async page => {
  await page.getByRole('button', { name: 'Nhập kết quả' }).first().click();
  await page.getByRole('button', { name: 'Lưu Kết Quả' }).click();
};

test('Đại Chiến Team shows two squads, three rounds and eight tournament points', async ({ page }) => {
  await openSetup(page, 'Đại Chiến Team');
  await expect(page.getByRole('button', { name: 'Nhập kết quả' })).toHaveCount(6);
  await expect(page.getByText('Team Neon').first()).toBeVisible();
  await expect(page.getByText('Team Lửa').first()).toBeVisible();
  const draw = await page.evaluate(() => JSON.parse(localStorage.getItem('pickleball_state_v2_3')).data.draws.event);
  expect(draw.scenario).toBe('teamclash');
  expect(draw.data).toHaveLength(3);
});

test('Cúp Tứ Hùng unlocks final only after all six group results', async ({ page }) => {
  await openSetup(page, 'Cúp Tứ Hùng');
  await expect(page.getByRole('button', { name: 'Bốc chung kết' })).toBeDisabled();
  for (let i = 0; i < 6; i++) await scoreFirst(page);
  await expect(page.getByRole('button', { name: 'Bốc chung kết' })).toBeEnabled();
  await page.getByRole('button', { name: 'Bốc chung kết' }).click();
  await expect(page.getByText('Chung kết & tranh hạng ba')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nhập kết quả' })).toHaveCount(2);
  const draw = await page.evaluate(() => JSON.parse(localStorage.getItem('pickleball_state_v2_3')).data.draws.event);
  expect(draw.data).toHaveLength(4);
});

test('Vua Sân Team advances winners and losers only after both courts finish', async ({ page }) => {
  await openSetup(page, 'Vua Sân Team');
  await expect(page.getByRole('button', { name: 'Đổi sân lượt 2' })).toBeDisabled();
  await scoreFirst(page); await scoreFirst(page);
  await page.getByRole('button', { name: 'Đổi sân lượt 2' }).click();
  await expect(page.getByText('Vua Sân · lượt 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đổi sân lượt 3' })).toBeDisabled();
  await scoreFirst(page); await scoreFirst(page);
  await page.getByRole('button', { name: 'Đổi sân lượt 3' }).click();
  await expect(page.getByText('Vua Sân · lượt 3')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});
