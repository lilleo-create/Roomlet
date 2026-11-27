import {expect,test} from "@playwright/test";
for (const width of [320,360,390,430,768,1440]) {
  test(`публичные маршруты помещаются при ширине ${width}`,async({page})=>{
    await page.setViewportSize({width,height:844});
    for(const path of ["/","/catalog","/favorites","/profile","/cart","/custom","/studio/login"]){
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    }
  });
}
