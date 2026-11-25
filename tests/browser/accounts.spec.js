import { test, expect } from '@playwright/test';
import { fixture } from '../fixtures.mjs';

for (const role of ['admin', 'manager']) {
  test(`${role} account access is enforced for the create-user tool`, async ({ page }) => {
    let requestBody = null;
    const user={id:'00000000-0000-0000-0000-000000000001',email:'amaquangvp@gmail.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:new Date().toISOString()};
    const token=`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`;
    await page.route(/^https:/, route => {
      const url=route.request().url();
      if(url.includes('/auth/v1/token')) return route.fulfill({json:{access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user}});
      if(url.includes('/auth/v1/user')) return route.fulfill({json:user});
      if(url.endsWith('/rest/v1/rpc/club_my_role')) return route.fulfill({json:role});
      if(url.endsWith('/rest/v1/rpc/club_read') || url.endsWith('/rest/v1/rpc/club_public_read')) return route.fulfill({json:{revision:1,data:fixture()}});
      if(url.endsWith('/functions/v1/create-club-account')) { requestBody=route.request().postDataJSON(); return route.fulfill({status:201,json:{username:requestBody.username,role:requestBody.role,recoveryEmail:'vanquanghc@gmail.com'}}); }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:4178/#accounts');
    await page.getByRole('button',{name:'Đăng nhập quản trị',exact:true}).click();
    await page.getByLabel('Email hoặc tên đăng nhập').fill('amaquangvp@gmail.com');
    await page.getByLabel('Mật khẩu').fill('test-password');
    await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();

    if(role === 'manager') {
      await expect(page.getByRole('heading',{name:'Không có quyền truy cập'})).toBeVisible();
      await page.getByRole('button',{name:'Xem Thêm'}).click();
      await expect(page.getByRole('button',{name:'Tài Khoản',exact:true})).toHaveCount(0);
      expect(requestBody).toBeNull();
      return;
    }
    await expect(page.getByRole('heading',{name:'Tạo tài khoản phụ'})).toBeVisible();
    await page.getByLabel('Tên đăng nhập').fill('pho');
    await page.getByLabel('Mật khẩu mới').fill('test-password');
    await page.getByRole('radio',{name:/Quản trị toàn quyền/}).check();
    await page.getByRole('button',{name:'Tạo tài khoản',exact:true}).click();
    await expect(page.getByText('Đã tạo pho với quyền quản trị toàn quyền. Có thể đăng nhập ngay.')).toBeVisible();
    expect(requestBody).toEqual({username:'pho',password:'test-password',role:'admin'});
    await expect(page.getByLabel('Mật khẩu mới')).toHaveValue('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  });
}
