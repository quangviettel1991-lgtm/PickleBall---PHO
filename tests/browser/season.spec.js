import { test, expect } from '@playwright/test';
import { fixture } from '../fixtures.mjs';

test.beforeEach(async ({ page }) => {
  const old = fixture();
  const current = structuredClone(old);
  current.members.forEach(member => {
    member.elo = 1000; member.eloDoubles = 1000; member.eloSingles = 1000;
    member.initialElo = 1000; member.initialEloDoubles = 1000; member.initialEloSingles = 1000;
  });
  current.matches = []; current.events = [{id:'event',name:'Khai mùa 2027',date:'2027-01-01'}]; current.draws = {};
  await page.addInitScript(({old,current}) => {
    if (sessionStorage.getItem('season-seeded')) return;
    for (const [id,data] of [['1',old],['3',current]]) localStorage.setItem(`pickleball_state_v2_${id}`,JSON.stringify({data,generation:`season-${id}`,baseRevision:0,acknowledged:true,pending:false}));
    sessionStorage.setItem('season-seeded','true');
  }, {old,current});
  await page.route(/^https:/, route => route.abort());
});

test('newest season opens by default and switching seasons preserves separate data',async({page},info)=>{
  await page.goto('http://127.0.0.1:4177/#dashboard');
  await expect(page.getByText('Chế độ thử trên máy — không kết nối dữ liệu CLB.')).toBeVisible();
  await expect(page.getByRole('button',{name:'2027',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('Sân đấu mới.')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({path:`test-results/${info.project.name}-season-2027.png`,fullPage:true,animations:'disabled'});
  const oldBefore=await page.evaluate(()=>localStorage.getItem('pickleball_state_v2_1'));
  await page.getByRole('button',{name:'2026',exact:true}).click();
  await expect(page).toHaveURL(/season=2026/);
  await expect(page.getByRole('button',{name:'2026',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('Mùa 2026 đã lưu trữ',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Ghi Điểm'}).click();
  await expect(page.getByRole('heading',{name:'Mùa giải đã lưu trữ'})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('pickleball_state_v2_1'))).toBe(oldBefore);
  await page.getByRole('button',{name:'2027',exact:true}).click();
  await expect(page).toHaveURL(/season=2027/);
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('pickleball_state_v2_3')).data);
  expect(data.members[0].eloDoubles).toBe(1000);
});

test('mystery draw records qualifiers then reveals a separate final',async({page},info)=>{
  await page.goto('http://127.0.0.1:4177/#draw');
  await expect(page.getByText('Chế độ thử trên máy — không kết nối dữ liệu CLB.')).toBeVisible();
  await page.getByRole('button',{name:/Đấu Đôi Bí Ẩn/}).click();
  await page.getByRole('combobox',{name:'Sự kiện liên kết'}).selectOption('event');
  await page.getByRole('button',{name:'Chọn tất cả'}).click();
  await page.getByRole('button',{name:/Bắt Đầu Bốc Thăm/}).click();
  await expect(page.getByText('Lượt Trận Thứ 3')).toBeVisible();
  await expect(page.getByRole('button',{name:/Bốc vòng lật kèo/})).toBeDisabled();
  for(let i=0;i<3;i++) {
    await page.getByRole('button',{name:'Nhập kết quả'}).first().click();
    await page.getByRole('button',{name:'Lưu Kết Quả'}).click();
  }
  await page.getByRole('button',{name:/Bốc vòng lật kèo/}).click();
  await expect(page.getByText(/Vòng lật kèo · 2 điểm giải/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({path:`test-results/${info.project.name}-mystery-final.png`,fullPage:true,animations:'disabled'});
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('pickleball_state_v2_3')).data);
  expect(data.draws.event.data).toHaveLength(4);
  expect(data.matches).toHaveLength(4);
  expect(data.matches.filter(match=>match.played)).toHaveLength(3);
});
