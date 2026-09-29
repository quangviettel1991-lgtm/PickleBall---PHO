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

test('password setup requests a recovery link back to the Phở website',async({page})=>{
  let recoveryUrl;
  await page.route(/^https:/,route=>{
    const url=route.request().url();
    if(url.includes('/auth/v1/recover')) { recoveryUrl=url; return route.fulfill({json:{}}); }
    if(url.endsWith('/rest/v1/rpc/club_public_read')) return route.fulfill({json:{revision:0,data:fixture()}});
    return route.abort();
  });
  await page.goto('/#finance');
  await page.getByRole('button',{name:'Đăng nhập quản trị',exact:true}).click();
  await page.getByRole('button',{name:'Chưa có hoặc quên mật khẩu?'}).click();
  await page.getByLabel('Email').fill('amaquangvp@gmail.com');
  await page.getByRole('button',{name:'Gửi liên kết đặt mật khẩu'}).click();
  await expect(page.getByText('Nếu email này có tài khoản')).toBeVisible();
  expect(new URL(recoveryUrl).searchParams.get('redirect_to')).toBe('http://127.0.0.1:4176/?auth=reset');
});

test('manager username opens club tools but never finance or database screens',async({page})=>{
  const ownerData=fixture();ownerData.transactions=[{id:'private',type:'income',amount:500}];
  await page.addInitScript(data=>localStorage.setItem('pickleball_state_v2_1',JSON.stringify({data,generation:'owner',baseRevision:1,acknowledged:true,pending:false})),ownerData);
  const calls=[];
  const user={id:'00000000-0000-0000-0000-000000000003',email:'amaquangvp+phoquanly@gmail.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
  const token=`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`;
  await page.route(/^https:/,route=>{
    const url=route.request().url();calls.push(url);
    if(url.includes('/auth/v1/token')) return route.fulfill({json:{access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user}});
    if(url.includes('/auth/v1/user')) return route.fulfill({json:user});
    if(url.endsWith('/rest/v1/rpc/club_my_role')) return route.fulfill({json:'manager'});
    if(url.endsWith('/rest/v1/rpc/club_read')) return route.fulfill({json:{revision:1,data:{...ownerData,transactions:[]}}});
    if(url.endsWith('/rest/v1/rpc/club_public_read')) return route.fulfill({json:{revision:1,data:{...ownerData,transactions:[]}}});
    return route.abort();
  });
  await page.goto('/#finance');
  await page.getByRole('button',{name:'Đăng nhập quản trị',exact:true}).click();
  await page.getByLabel('Email hoặc tên đăng nhập').fill('quanly');
  await page.getByLabel('Mật khẩu').fill('strong-password');
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Không có quyền truy cập'})).toBeVisible();
  await page.goto('/#backup');
  await expect(page.getByRole('heading',{name:'Không có quyền truy cập'})).toBeVisible();
  await page.goto('/#members');
  await expect(page.getByRole('heading',{name:'Danh Sách Thành Viên'})).toBeVisible();
  await page.getByRole('button',{name:'Xem Thêm'}).click();
  await expect(page.getByRole('button',{name:'Thu Chi'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'CSDL'})).toHaveCount(0);
  expect(calls.some(url=>url.endsWith('/rest/v1/rpc/club_save'))).toBe(false);
});
