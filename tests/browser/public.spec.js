import { test, expect } from '@playwright/test';
import { fixture } from '../fixtures.mjs';
test.use({baseURL:'http://127.0.0.1:4176'});
test('public visitors neither load private local data nor call private RPCs',async({page})=>{
  const privateData=fixture();privateData.members[0].name='PRIVATE-CACHE-NAME';privateData.transactions=[{id:'private',amount:123456789}];
  await page.addInitScript(data=>localStorage.setItem('pickleball_club_data_1',JSON.stringify(data)),privateData);
  const calls=[];
  await page.route(/^https:/,route=>{
    const url=route.request().url();calls.push(url);
    if(url.endsWith('/rest/v1/rpc/club_public_read')) {
      const data=fixture();data.members=data.members.map(({id,name,elo,eloSingles,eloDoubles})=>({id,name,elo,eloSingles,eloDoubles}));
      return route.fulfill({json:{revision:1,data}});
    }
    return route.abort();
  });
  await page.goto('/#dashboard');await expect(page.getByText('Chế độ xem công khai.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('PRIVATE-CACHE-NAME');
  await page.goto('/#finance');await expect(page.getByRole('heading',{name:'Đăng nhập để quản lý CLB'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Đăng nhập để quản lý CLB'})).toBeVisible();
  expect(calls.some(url=>/\/rpc\/club_(read|save)$/.test(url))).toBe(false);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pickleball_club_data_1')).members[0].name)).toBe('PRIVATE-CACHE-NAME');
  await page.getByRole('button',{name:'Đăng nhập quản trị',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();await expect(page.getByLabel('Mật khẩu')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
