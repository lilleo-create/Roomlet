import {expect,test} from "@playwright/test";

test("страницы мастера требуют входа, вход по email доступен", async ({page})=>{
  for(const path of ["/studio","/studio/calendar","/studio/products","/studio/settings"]){
    await page.goto(path);
    await expect(page).toHaveURL(/\/studio\/login/);
    await expect(page.getByLabel("Пароль",{exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Открыть демо"})).toHaveCount(0);
  }
});
