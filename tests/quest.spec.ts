import {test,expect} from '@playwright/test'
import fs from 'node:fs'
import {answerQuestion,clearBattle,canvasClick} from './combat-helper'
async function fillAssignment(page:any,question='Find one half as a number.',key='0.5 | half'){
 await page.locator('#new-assignment').click();await page.locator('#quest-name').fill('My custom assignment');await page.locator('[data-field="question"]').fill(question);await page.locator('[data-field="key"]').fill(key)
}
test('landing credit, assignment popup and dedicated game window work together',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/')
 await expect(page.getByRole('heading',{name:'Made by Shrey Rawat · BMU'})).toBeVisible();await expect(page.getByRole('link',{name:/shrey.rawat.26cse@bmu.edu.in/})).toHaveAttribute('href','mailto:shrey.rawat.26cse@bmu.edu.in')
 await expect(page.locator('canvas')).toHaveCount(0);await fillAssignment(page)
 const popupPromise=page.waitForEvent('popup');await page.locator('#save-quest').click();const play=await popupPromise
 await expect(play).toHaveURL(/play\.html\?quest=/);await expect(play.locator('canvas')).toBeVisible();await expect(play.locator('#question-dialog')).not.toBeVisible()
 await answerQuestion(play,'1/2');await expect(play.locator('#xp-label')).toContainText('100 XP')
 expect(await play.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true)
 await page.bringToFront();await expect(page.locator('#assignment-select option')).toHaveCount(2)
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'test-results/questbound-landing.png',fullPage:true})
 expect(errors).toEqual([]);await play.close()
})
test('popup blocked fallback remains usable',async({page})=>{await page.goto('/');await page.evaluate(()=>{window.open=()=>null});await page.locator('#play-demo').click();await expect(page.locator('#launch-fallback')).toBeVisible();await expect(page.locator('#launch-fallback')).toHaveAttribute('href',/play.html\?quest=/)})
test('six maths rooms, creatures, jump controls and boss complete the assignment',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/play.html');await expect(page.locator('canvas')).toBeVisible()
 await page.locator('#gate-button').click();await page.locator('#answer').fill('18');await page.locator('#submit-answer').click();await expect(page.locator('#answer-feedback')).toContainText('Not quite');await page.locator('#close-question').click()
 const answers=['19','32','210','486','16','93'];const creatures=['lizard','slime','bat','skeleton','imp','spider']
 for(let i=0;i<answers.length;i++){
  await expect(page.locator('#battle-status')).toHaveAttribute('data-creature',creatures[i]);await answerQuestion(page,answers[i]);await clearBattle(page)
  if(i<answers.length-1){await canvasClick(page,595,139);await expect(page.locator('#room-title')).not.toHaveText(['The First Step','The Tower of Terms','The Sumkeeper','The Doubling Dungeon','The Infinite Bridge'][i],{timeout:8000})}
 }
 await expect(page.locator('#victory-dialog')).toBeVisible();await expect(page.locator('#victory-badges .earned')).toHaveCount(3)
 const downloadPromise=page.waitForEvent('download');await page.locator('#victory-export').click();const content=fs.readFileSync((await(await downloadPromise).path())!,'utf8');expect(content).toContain('6/6 answers correct');expect(content).toContain('<p>486</p>');expect(content).toContain('Honor of the Proudest Knight')
 await page.screenshot({path:'test-results/questbound-victory.png',fullPage:true});expect(errors).toEqual([])
})
test('editor validates keys, adds/removes gates and preserves independent slots',async({page})=>{
 await page.goto('/');await fillAssignment(page,'2+2?','4 |');await page.locator('#save-quest').click();await expect(page.locator('#setup-error')).toContainText('empty alternatives')
 await page.locator('[data-field="key"]').fill('4');await page.locator('#add-question').click();await page.locator('.question-row').nth(1).locator('[data-field="question"]').fill('3+3?');await page.locator('.question-row').nth(1).locator('[data-field="key"]').fill('6');await page.locator('#add-question').click();await page.locator('.question-row').nth(2).getByRole('button',{name:'Remove question'}).click()
 const popupPromise=page.waitForEvent('popup');await page.locator('#save-quest').click();const play=await popupPromise;await answerQuestion(play,'4');await play.close();await page.bringToFront();await expect(page.locator('#assignment-select option')).toHaveCount(2)
 await page.locator('#customize').click();await page.locator('#hero-name').fill('Sir Shrey');const secondPopup=page.waitForEvent('popup');await page.locator('#save-quest').click();const reopened=await secondPopup;await expect(reopened.locator('#xp-label')).toContainText('100 XP');await reopened.close()
})
test('backup import and invalid files keep existing work',async({page})=>{
 await page.goto('/');await page.locator('#restore-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await expect(page.locator('#landing-status')).not.toHaveText('');await expect(page.locator('#assignment-select option')).toHaveCount(1)
 const downloaded=page.waitForEvent('download');await page.locator('#backup').click();const path=(await(await downloaded).path())!;await page.locator('#restore-file').setInputFiles(path);await expect(page.locator('#assignment-select option')).toHaveCount(2)
})
test('numeric equivalence is safe and no expressions execute',async({page})=>{await page.goto('/');const result=await page.evaluate(async()=>{const{matchesAnswer}=await import('/src/assignments.ts' as string);return[matchesAnswer('1/2','0.5'),matchesAnswer('50%','0.5'),matchesAnswer(' HALF ','0.5 | half'),matchesAnswer('−4','-4'),matchesAnswer('1,000','1000'),!matchesAnswer('1/0','0'),!matchesAnswer('1,9','19'),!matchesAnswer('2+2','4'),!matchesAnswer('','0')]});expect(result.every(Boolean)).toBe(true)})
test('mobile landing, game and question popup fit without document scrolling',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.goto('/play.html');await expect(page.locator('canvas')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.locator('#gate-button').click();await expect(page.locator('#question-dialog')).toBeVisible();expect(await page.locator('#question-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await page.locator('#answer').fill('19');await page.locator('#submit-answer').click();await page.screenshot({path:'test-results/questbound-mobile.png',fullPage:true})
})
test('invalid storage recovers and storage failure permits play and export',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('questbound-assignments-v2','{invalid');Storage.prototype.setItem=()=>{throw Error('Storage disabled')}});await page.goto('/play.html');await expect(page.locator('#save-status')).toContainText('unavailable');await answerQuestion(page,'19');await page.locator('#pause-button').click();const download=page.waitForEvent('download');await page.locator('#export').click();expect((await download).suggestedFilename()).toBe('questbound-assignment.html')
})

