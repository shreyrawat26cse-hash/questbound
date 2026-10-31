import {test,expect} from '@playwright/test'
import {answerQuestion} from './combat-helper'
test('editing while the game is open keeps fresh progress and cannot be reverted by the old window',async({page})=>{
 await page.goto('/');const popupPromise=page.waitForEvent('popup');await page.locator('#play-demo').click();const play=await popupPromise;await answerQuestion(play,'19');await page.bringToFront();await page.locator('#customize').click();await page.locator('#quest-name').fill('The Reforged Quest');await page.locator('#save-quest').click();if(!play.isClosed())await play.close();
 await page.bringToFront();await page.reload()
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('questbound-assignments-v2')!).quests.find((q:any)=>q.title==='The Reforged Quest'))
 expect(saved).toBeTruthy();expect(saved.levels[0].answer).toBe('19');expect(saved.levels[0].completed).toBe(true)
})
test('on-screen jump retains held movement keys',async({page})=>{
 await page.goto('/play.html');await expect(page.locator('#loading-screen')).toBeHidden();await page.waitForTimeout(450);await page.locator('canvas').click({position:{x:20,y:20}});const status=page.locator('#battle-status');await page.keyboard.down('ArrowRight');await expect.poll(async()=>Number(await status.getAttribute('data-hero-x'))).toBeGreaterThan(150);await page.locator('#jump-button').click();await expect(status).toHaveAttribute('data-jumping','true');await expect.poll(async()=>Number(await status.getAttribute('data-hero-x'))).toBeGreaterThan(220);await page.keyboard.up('ArrowRight')
})
