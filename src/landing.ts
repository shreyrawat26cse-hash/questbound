import './ui.css'
import { loadLibrary, STORAGE, sanitizeLibrary, type Quest } from './assignments'
import { mountEditor } from './quest-editor'
import { readAssignmentFile } from './assignment-import'
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
let library=loadLibrary()
let current=library.quests.find(q=>q.id===library.active)!
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(library));$('save-status').textContent='Saved on this device'}catch{$('save-status').textContent='Browser storage unavailable. Back up your quests before closing.'}}
function render(){const select=$<HTMLSelectElement>('assignment-select');select.replaceChildren();library.quests.forEach(q=>{const option=document.createElement('option');option.value=q.id;option.textContent=`${q.title} · ${q.levels.filter(l=>l.completed).length}/${q.levels.length} answers`;select.append(option)});select.value=current.id;$<HTMLButtonElement>('new-assignment').disabled=library.quests.length>=10;$<HTMLButtonElement>('begin-quest').disabled=library.quests.length>=10}
function launch(q:Quest){
  current=q;library.active=q.id;persist()
  const url=new URL('play.html',window.location.href);url.searchParams.set('quest',q.id)
  const popup=window.open(url.href,'questbound-adventure','popup=yes,width=1360,height=900')
  const fallback=$<HTMLAnchorElement>('launch-fallback');fallback.href=url.href;fallback.hidden=!!popup
  if(popup){try{popup.opener=null;popup.focus()}catch{}$('landing-status').textContent='Your adventure is open in its own game window. Your work saves automatically.'}
  else $('landing-status').textContent='Your browser blocked the game window. Click Open game window below to continue.'
}
const editor=mountEditor(()=>current,(q,isNew)=>{const fresh=loadLibrary();if(isNew&&fresh.quests.length>=10){$('landing-status').textContent='All 10 slots are filled. Edit an existing quest to continue.';return}library=fresh;const previous=fresh.quests.find(item=>item.id===q.id);if(previous&&JSON.stringify(previous.levels.map(l=>[l.question,l.key]))===JSON.stringify(q.levels.map(l=>[l.question,l.key]))){q.current=previous.current;q.levels.forEach((l,i)=>Object.assign(l,{answer:previous.levels[i].answer,completed:previous.levels[i].completed,combatWon:previous.levels[i].combatWon,chests:[...previous.levels[i].chests],attempts:previous.levels[i].attempts}))}const i=library.quests.findIndex(item=>item.id===q.id);if(i<0)library.quests.push(q);else library.quests[i]=q;current=q;library.active=q.id;persist();render();launch(q)})
$('new-assignment').onclick=()=>editor.open(true);$('begin-quest').onclick=()=>editor.open(true);$('customize').onclick=()=>editor.open(false)
$('assignment-select').onchange=()=>{current=library.quests.find(q=>q.id===$<HTMLSelectElement>('assignment-select').value)!;library.active=current.id;persist()}
$('resume-quest').onclick=()=>launch(current)
$('play-demo').onclick=()=>{const demo=library.quests.find(q=>q.title==='Sequences & Series: The Lost Crown')||library.quests[0];launch(demo)}
function download(content:string,name:string){const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
$('backup').onclick=()=>{download(JSON.stringify(library,null,2),'questbound-backup.json');$('landing-status').textContent='Backup downloaded, including assignment keys and progress.'}
$('restore').onclick=()=>$<HTMLInputElement>('restore-file').click()
$('restore-file').onchange=async()=>{const input=$<HTMLInputElement>('restore-file'),file=input.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw Error('Choose a backup smaller than 2 MB.');const imported=sanitizeLibrary(JSON.parse(await file.text()));if(!imported)throw Error('This is not a valid Questbound backup.');library=loadLibrary();if(library.quests.length+imported.quests.length>10)throw Error('This import would exceed the 10-slot limit.');imported.quests.forEach(q=>{q.id=crypto.randomUUID();library.quests.push(q)});current=imported.quests[0];library.active=current.id;persist();render();$('landing-status').textContent='Imported into new slots. Existing assignments were kept.'}catch(e){$('landing-status').textContent=e instanceof Error?e.message:'Import failed. Your work is unchanged.'}finally{input.value=''}}
window.addEventListener('storage',e=>{if(e.key===STORAGE&&!editor.dialog.open){library=loadLibrary();current=library.quests.find(q=>q.id===current.id)||library.quests[0];render()}})
render();persist()

let importing=false
async function importAssignment(file:File){
 if(importing)return
 if(library.quests.length>=10){$('file-status').textContent='All 10 slots are filled. Edit a saved quest or back up your library first.';return}
 importing=true;$('file-status').textContent='Reading your assignment…';$<HTMLButtonElement>('assignment-dropzone').disabled=true
 try{const result=await readAssignmentFile(file);$('file-status').textContent=result.levels.length+' levels generated. Review the answers, then start playing.';editor.openImported(result)}catch(error){$('file-status').textContent=error instanceof Error?error.message:'Could not read this assignment. Try the sample file.'}
 finally{importing=false;$<HTMLButtonElement>('assignment-dropzone').disabled=false;$<HTMLInputElement>('assignment-file').value=''}
}
const dropzone=$('assignment-dropzone')
dropzone.onclick=()=>$<HTMLInputElement>('assignment-file').click()
$('assignment-file').onchange=()=>{const file=$<HTMLInputElement>('assignment-file').files?.[0];if(file)void importAssignment(file)}
for(const type of ['dragenter','dragover'])dropzone.addEventListener(type,e=>{e.preventDefault();dropzone.classList.add('dragging')})
dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('dragging'))
dropzone.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();dropzone.classList.remove('dragging');const files=(event as DragEvent).dataTransfer?.files;if(files?.length===1)void importAssignment(files[0]);else $('file-status').textContent='Drop one assignment file at a time.'})
window.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('Files'))event.preventDefault()})
window.addEventListener('drop',event=>{event.preventDefault();const files=event.dataTransfer?.files;if(editor.dialog.open){$('setup-error').textContent='Close this editor before importing another assignment.';return}if(files?.length===1)void importAssignment(files[0]);else $('file-status').textContent='Drop one assignment file at a time.'})
