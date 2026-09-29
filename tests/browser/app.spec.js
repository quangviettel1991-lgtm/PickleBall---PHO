import { test, expect } from '@playwright/test';
import { fixture, matchInput } from '../fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page })=>{
  const data=fixture();data.matches=[{...matchInput(),id:'existing',played:true,eloChanges:{a:16,b:-16}}];data.members[0].eloSingles=1016;data.members[1].eloSingles=984;
  await page.addInitScript(data=>{
    if(!sessionStorage.getItem('test-seeded')) {
      localStorage.setItem('pickleball_state_v2_1',JSON.stringify({data,generation:'browser-test',baseRevision:1,acknowledged:true,pending:false}));
      sessionStorage.setItem('test-seeded','true');
    }
  },data);
  await page.route(/^https:/,route=>route.abort());
});
test('all screens render without exceptions and keep main content inside viewport',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const tab of ['dashboard','leaderboard','h2h','members','events','recorder','draw','finance','backup']){
    await page.goto('/#'+tab);await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText('Đang mở màn hình…')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('Chưa mở được màn hình');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    expect(overflow,`${tab} horizontal overflow`).toBe(false);
  }
  await page.screenshot({path:`test-results/${info.project.name}-backup.png`,fullPage:true,animations:'disabled'});
  expect(errors).toEqual([]);
});
test('rename via member form preserves Elo and modal focus is contained',async({page})=>{
  await page.goto('/#members');
  const edit=page.getByRole('button', { name: 'Sửa thành viên', exact: true }).first();
  await edit.click();
  const modal=page.getByRole('dialog');await expect(modal).toBeVisible();
  await modal.locator('input[type="text"]').first().fill('Renamed through UI');
  for(let i=0;i<20;i++)await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>!!document.activeElement.closest('dialog'))).toBe(true);
  await modal.locator('button[type="submit"]').click();
  await expect(modal).toHaveCount(0);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pickleball_state_v2_1')).data);
  expect(saved.members.find(m=>m.name==='Renamed through UI').eloSingles).toBe(1016);
});
test('invalid restore file leaves persisted data unchanged',async({page})=>{
  await page.goto('/#backup');const before=await page.evaluate(()=>localStorage.getItem('pickleball_state_v2_1'));
  await page.locator('input[type="file"]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"members":[{}],"events":[],"matches":[]}')});
  await expect(page.locator('.backup-container')).toContainText('ID thiếu');
  expect(await page.evaluate(()=>localStorage.getItem('pickleball_state_v2_1'))).toBe(before);
});
test('head to head includes recorded completed matches',async({page})=>{
  await page.goto('/#h2h');
  const selects=page.locator('main select');await selects.nth(0).selectOption('a');await selects.nth(1).selectOption('b');
  await expect(page.locator('main')).toContainText('Player a');
  await expect(page.locator('main')).not.toContainText('Chưa có trận');
});
test('reload and browser back preserve tab navigation',async({page})=>{
  await page.goto('/#members');await page.reload();await expect(page).toHaveURL(/#members$/);
  await page.evaluate(()=>location.hash='finance');await expect(page.locator('.finance-container')).toBeVisible();
  await page.goBack();await expect(page).toHaveURL(/#members$/);
});
test('second tab is read-only and cannot overwrite first tab changes',async({page,context})=>{
  await page.goto('/#members');await expect(page.getByText('Chế độ thử trên máy — không kết nối dữ liệu CLB.')).toBeVisible();
  const second=await context.newPage();await second.goto('/#members');
  await expect(second.getByText('Tab chỉ đọc: đóng tab quản lý khác rồi tải lại để chỉnh sửa.')).toBeVisible();
  await expect(second.getByRole('button',{name:'Sửa thành viên',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pickleball_state_v2_1')).data.members[0].name)).toBe('Player a');
  await page.close();
  await expect(second.getByText('Chế độ thử trên máy — không kết nối dữ liệu CLB.')).toBeVisible({timeout:10000});
  await second.getByRole('button',{name:'Sửa thành viên',exact:true}).first().click();
  await second.getByRole('dialog').locator('input[type="text"]').first().fill('Must not save');
  await second.getByRole('dialog').locator('button[type="submit"]').click();
  await expect(second.getByRole('dialog')).toHaveCount(0);
  expect(await second.evaluate(()=>JSON.parse(localStorage.getItem('pickleball_state_v2_1')).data.members[0].name)).toBe('Must not save');
  await second.close();
});

test('a single tab can acquire the writer lock after a slow browser response',async({page})=>{
  await page.addInitScript(()=>{
    const request=navigator.locks.request.bind(navigator.locks);
    navigator.locks.request=(...args)=>new Promise((resolve,reject)=>{
      setTimeout(()=>request(...args).then(resolve,reject),800);
    });
  });
  await page.goto('/#members');
  await expect(page.getByText('Chế độ thử trên máy — không kết nối dữ liệu CLB.')).toBeVisible();
  await page.getByRole('button',{name:'Sửa thành viên',exact:true}).first().click();
  const modal=page.getByRole('dialog');
  await modal.locator('input[type="text"]').first().fill('Slow lock acquired');
  await modal.locator('button[type="submit"]').click();
  await expect(modal).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pickleball_state_v2_1')).data.members[0].name)).toBe('Slow lock acquired');
});

test('screens and management dialogs expose accessible names and contrast',async({page},info)=>{
  test.skip(info.project.name !== 'desktop', 'Shared semantic markup; responsive behavior is covered separately.');
  test.setTimeout(60000);
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const tab of ['dashboard','leaderboard','h2h','members','events','recorder','draw','finance','backup']) {
    await page.goto('/#'+tab);
    await expect(page.getByText('Đang mở màn hình…')).toHaveCount(0);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),tab).toEqual([]);
  }
  for (const [tab,button] of [['members','Thêm thành viên'],['events','Tạo sự kiện mới'],['dashboard','Thêm thành viên mới'],['finance','Ghi khoản mới']]) {
    await page.goto('/#'+tab);await page.getByRole('button',{name:button,exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),`${tab} dialog`).toEqual([]);
    await page.keyboard.press('Escape');
  }
});
