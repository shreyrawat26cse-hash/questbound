import Phaser from 'phaser'
import './ui.css'
import QuestDungeon from './scenes/QuestDungeon'
import { loadLibrary, sanitizeLibrary, STORAGE, matchesAnswer, badges, type Quest } from './assignments'
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
let library=loadLibrary()
const requested=new URLSearchParams(location.search).get('quest')
export let quest=library.quests.find(q=>q.id===requested)||library.quests.find(q=>q.id===library.active)!
library.active=quest.id
const definition=(q:Quest)=>JSON.stringify([q.hero,q.title,q.levels.map(l=>[l.name,l.question,l.key,l.hint])])
const initialDefinition=definition(quest)
let chestMode:number|null=null
let finisherQuestion=false
let chestDraft=''
let toastTimer:ReturnType<typeof setTimeout>
let victoryTimer:ReturnType<typeof setTimeout>
const questionDialog=$<HTMLDialogElement>('question-dialog')
const pauseMenu=$<HTMLDialogElement>('pause-menu')
const victoryDialog=$<HTMLDialogElement>('victory-dialog')
function persist(){
  try{
    const disk=sanitizeLibrary(JSON.parse(localStorage.getItem(STORAGE)||'null'))
    if(disk){const newer=disk.quests.find(q=>q.id===quest.id);if(newer&&definition(newer)!==initialDefinition){library=disk;$('save-status').textContent='Assignment updated · reopen adventure';return}library=disk;const i=library.quests.findIndex(q=>q.id===quest.id);if(i<0)library.quests.push(quest);else library.quests[i]=quest}
    library.active=quest.id;localStorage.setItem(STORAGE,JSON.stringify(library));$('save-status').textContent='Saved on this device'
  }catch{$('save-status').textContent='Storage unavailable · export your work'}
}
function toast(text:string){$('feedback').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('feedback').textContent=''},6000)}
// Scene messages use the same live region; an observer keeps them readable without a permanent overlay.
new MutationObserver(()=>{const hasText=!!$('feedback').textContent;$('feedback').classList.toggle('visible',hasText)}).observe($('feedback'),{childList:true,characterData:true,subtree:true})
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:640,height:440,backgroundColor:'#10151b',pixelArt:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[QuestDungeon]})
game.events.once('game-ready',()=>{$('loading-screen').hidden=true;$('play-controls').inert=false})
function focusGame(reset=true){(document.activeElement as HTMLElement)?.blur();$('game').focus({preventScroll:true});if(reset)game.events.emit('reset-controls')}
function closeQuestions(){questionDialog.close();chestMode=null;finisherQuestion=false;focusGame()}
function bonus(index:number){const a=quest.current+3+index,b=(quest.current+1)*2;return{question:`Treasure riddle: What is ${a} + ${b}?`,key:String(a+b)}}
function questionView(){
  const level=quest.levels[quest.current]
  const isChest=chestMode!==null
  $('question-kind').textContent=isChest?'BONUS TREASURE CHALLENGE':finisherQuestion?'THE FINAL BLOW':'THE ASSIGNMENT SEAL'
  $('question-number').textContent=isChest?`CHEST ${chestMode!+1} · +25 XP & +2 HP`:`QUESTION ${String(quest.current+1).padStart(2,'0')}`
  $('answer-state').textContent=isChest?'BONUS':level.completed?'CORRECT ✓':level.attempts?'TRY AGAIN':'SEALED'
  $('question').textContent=isChest?bonus(chestMode!).question:level.question
  $<HTMLTextAreaElement>('answer').value=isChest?chestDraft:level.answer
  $<HTMLTextAreaElement>('answer').readOnly=!isChest&&level.completed
  $('hint-box').hidden=isChest||!level.hint.trim();$<HTMLDetailsElement>('hint-box').open=false;$('hint-text').textContent=level.hint
  $('question-help').textContent=isChest?'Solve this optional riddle to open the chest. Your assignment answer is kept separately.':finisherQuestion?'Answer correctly to unleash your sword finisher. The staggered enemy cannot attack.':'Enter the final answer. Combat pauses until you close this popup.'
  $('submit-answer').textContent=isChest?'Unlock treasure chest ✦':level.completed?(finisherQuestion?'Deliver the final blow ⚔':'Return to battle ⚔'):(finisherQuestion?'Answer & finish the enemy ⚔':'Check answer ✦')
  $('word-count').textContent=`${$<HTMLTextAreaElement>('answer').value.trim().length} characters`
}
export function approachGate(forFinisher=false){
  finisherQuestion=forFinisher
  if(pauseMenu.open)pauseMenu.close()
  chestMode=null;questionView();$('answer-feedback').textContent=''
  if(!questionDialog.open)questionDialog.showModal()
  $('answer').focus({preventScroll:true});game.events.emit('reset-controls')
}
export function openChest(index:number){
  if(index!==0&&index!==1)return
  if(quest.levels[quest.current].chests[index]){toast('This chest is already open. Your treasure is saved.');return}
  finisherQuestion=false;chestMode=index;chestDraft='';questionView();$('answer-feedback').textContent=''
  if(!questionDialog.open)questionDialog.showModal()
  $('answer').focus({preventScroll:true});game.events.emit('reset-controls')
}
function renderBadges(id:string){const list=$(id);list.replaceChildren();badges(quest).forEach(b=>{const item=document.createElement('div');item.className=`honor-badge ${b.earned?'earned':'locked'}`;const icon=document.createElement('span');icon.textContent=b.icon;const text=document.createElement('div');const title=document.createElement('strong');title.textContent=b.name;const detail=document.createElement('small');detail.textContent=`${b.earned?'Earned':'Locked'} · ${b.detail}`;text.append(title,detail);item.append(icon,text);list.append(item)})}
function render(){
  const done=quest.levels.filter(l=>l.completed).length,treasure=quest.levels.reduce((n,l)=>n+l.chests.filter(Boolean).length,0)
  $('hero-label').textContent=quest.hero;$('quest-label').textContent=quest.title;$('room-title').textContent=quest.levels[quest.current].name
  $('xp-label').textContent=`${done*100+treasure*25} XP · ${quest.current+1}/${quest.levels.length}`
  $('progress-label').textContent=`${done}/${quest.levels.length} answers · ${treasure} chests`
  const progress=$<HTMLProgressElement>('progress');progress.max=quest.levels.length;progress.value=done
  const nav=$('level-list');nav.replaceChildren();quest.levels.forEach((l,i)=>{const button=document.createElement('button');button.className=`level ${i===quest.current?'active':''}`;button.textContent=`${l.completed&&l.combatWon?'✓':String(i+1).padStart(2,'0')}  ${l.name}`;button.disabled=!quest.levels.slice(0,i).every(l=>l.completed&&l.combatWon);button.onclick=()=>{clearTimeout(victoryTimer);quest.current=i;persist();render();pauseMenu.close();game.events.emit('quest-changed');focusGame()};nav.append(button)})
  renderBadges('badge-list');renderBadges('victory-badges')
}
function celebrate(){if(!quest.levels.every(l=>l.completed&&l.combatWon))return;clearTimeout(victoryTimer);victoryTimer=setTimeout(()=>{if(!quest.levels.every(l=>l.completed&&l.combatWon))return;if(questionDialog.open)closeQuestions();if(pauseMenu.open)pauseMenu.close();if(!victoryDialog.open)victoryDialog.showModal();game.events.emit('reset-controls')},1100)}
export function recordCombatWin(){if(quest.levels[quest.current].combatWon)return;quest.levels[quest.current].combatWon=true;persist();render();celebrate()}
export function nextRoom(){
  if(!quest.levels[quest.current].completed){approachGate();return}
  if(!quest.levels[quest.current].combatWon){toast('Break the seal AND defeat the monsters on both floors. Jump with Shift/K; climb with E.');focusGame();return}
  if(quest.current<quest.levels.length-1){clearTimeout(victoryTimer);quest.current++;persist();render();game.events.emit('quest-changed');toast('A new floor. A new creature. Keep going, brave knight.');focusGame()}
  else celebrate()
}
$('answer').addEventListener('input',()=>{const value=$<HTMLTextAreaElement>('answer').value;if(chestMode!==null)chestDraft=value;else if(!quest.levels[quest.current].completed){quest.levels[quest.current].answer=value;persist()}$('word-count').textContent=`${value.trim().length} characters`;$('answer-feedback').textContent=''})
$('submit-answer').onclick=()=>{
  const level=quest.levels[quest.current]
  if(chestMode===null&&level.completed){const finish=finisherQuestion;closeQuestions();if(finish)game.events.emit('answer-correct');return}
  const value=$<HTMLTextAreaElement>('answer').value
  if(!value.trim()){$('answer-feedback').textContent='Write an answer first.';$('answer').focus();return}
  if(chestMode!==null){
    if(!matchesAnswer(value,bonus(chestMode).key)){$('answer-feedback').textContent='Not quite. Count carefully and try again.';return}
    const index=chestMode;level.chests[index]=true;persist();render();closeQuestions();game.events.emit('chest-unlocked',index);toast('Treasure unlocked! +25 XP and up to +2 health.');return
  }
  level.answer=value;level.attempts++
  if(!matchesAnswer(value,level.key)){persist();$('answer-state').textContent='TRY AGAIN';$('answer-feedback').textContent='Not quite! The seal stays intact. Try again, or open the hint.';game.events.emit('answer-wrong');return}
  level.completed=true;persist();render();closeQuestions();game.events.emit('answer-correct');toast('Correct! +100 XP. Land two hits on the upper guardian, then press F for the finishing strike.');celebrate()
}
$('close-question').onclick=closeQuestions
questionDialog.addEventListener('cancel',()=>{chestMode=null;finisherQuestion=false;setTimeout(focusGame,0)})
questionDialog.addEventListener('close',()=>{game.events.emit('reset-controls')})
$('gate-button').onclick=()=>approachGate()
$('pause-button').onclick=()=>{game.events.emit('reset-controls');if(!pauseMenu.open)pauseMenu.showModal()}
$('close-pause').onclick=()=>{pauseMenu.close();focusGame()}
$('close-victory').onclick=()=>{victoryDialog.close();focusGame()}
for(const dialog of [pauseMenu,victoryDialog])dialog.addEventListener('cancel',()=>setTimeout(focusGame,0))
$('fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('Fullscreen is unavailable here. Maximize the game window instead.')}focusGame()}
function download(content:string,type:string,name:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
function exportAnswers(){const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escape(quest.title)}</title><style>body{font:16px/1.7 Georgia,serif;max-width:800px;margin:50px auto;padding:0 25px;color:#222}section{margin:30px 0;break-inside:avoid}p{white-space:pre-wrap}small{color:#666}@media print{button{display:none}}</style></head><body><h1>${escape(quest.title)}</h1><p>Student: ${escape(quest.hero)}</p><small>${quest.levels.filter(l=>l.completed).length}/${quest.levels.length} answers correct against the supplied key. Final answers only; reasoning is not graded.</small>${quest.levels.map((l,i)=>`<section><small>${i+1}. ${escape(l.name)} · ${l.completed?'Correct':'Not verified'}</small><h2>${escape(l.question)}</h2><p>${escape(l.answer||'[Not answered yet]')}</p></section>`).join('')}<h2>Hall of Honor</h2><ul>${badges(quest).filter(b=>b.earned).map(b=>`<li>${escape(b.name)}</li>`).join('')}</ul><button onclick="window.print()">Print / Save as PDF</button></body></html>`;download(html,'text/html;charset=utf-8','questbound-assignment.html');toast('Assignment exported. Open the file to print or save as PDF.')}
$('export').onclick=exportAnswers;$('victory-export').onclick=exportAnswers
$('backup').onclick=()=>{persist();download(JSON.stringify(library,null,2),'application/json','questbound-backup.json');toast('All quests backed up, including answer keys and progress.')}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-direction]')){button.onpointerdown=e=>{e.preventDefault();if(document.querySelector('dialog[open]'))return;focusGame(false);button.setPointerCapture(e.pointerId);game.events.emit('move-touch',button.dataset.direction)};for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>game.events.emit('move-touch',''))}
const attack=$('attack-button');attack.onpointerdown=e=>{e.preventDefault();if(document.querySelector('dialog[open]'))return;focusGame(false);attack.setPointerCapture(e.pointerId);game.events.emit('attack-held',true)};for(const name of ['pointerup','pointercancel','lostpointercapture'])attack.addEventListener(name,()=>game.events.emit('attack-held',false))
$('finisher-button').onclick=()=>{focusGame(false);game.events.emit('finisher-request')}
$('jump-button').onclick=()=>{focusGame(false);game.events.emit('jump-request')};$('climb-button').onclick=()=>{focusGame(false);game.events.emit('climb-ladder')};$('retry-battle').onclick=()=>{focusGame();game.events.emit('retry-battle')}
window.addEventListener('blur',()=>game.events.emit('reset-controls'))
window.addEventListener('pagehide',persist)
render();persist()

