import type { Level, Quest } from './assignments'
import { newId } from './assignments'
import type { ImportedAssignment } from './assignment-import'
export const editorMarkup = `<dialog id="setup"><form id="setup-form"><div class="modal-heading"><div><div class="eyebrow">MAKE IT YOUR ADVENTURE</div><h2 id="editor-title">Build your quest</h2></div><button type="button" id="close-setup" class="icon-button" aria-label="Close quest editor">×</button></div><p class="muted">Every question becomes a sealed gate. Add the correct final answer to unlock it.</p><div class="form-grid"><label>Hero name<input id="hero-name" maxlength="40" required></label><label>Assignment name<input id="quest-name" maxlength="80" required></label></div><div class="editor-help">Accepted alternatives: <strong>0.5 | half</strong>. Fractions such as <strong>1/2</strong> match 0.5. Use short final answers; essays and reasoning are not graded.</div><div id="question-rows"></div><button id="add-question" type="button" class="button">+ Add question</button><p class="small muted">Changing questions or answer keys resets this assignment’s progress. Name and hint changes keep your work. Other slots stay safe.</p><div id="setup-error" role="alert"></div><button id="save-quest" class="button primary" type="submit">Save assignment & play <span>→</span></button></form></dialog>`
export function mountEditor(getQuest: () => Quest, onSave: (q: Quest, isNew: boolean) => void) {
  document.body.insertAdjacentHTML('beforeend', editorMarkup)
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
  const dialog = $<HTMLDialogElement>('setup')
  let editingNew = false
  let original: Quest
  function renumber() {
    document.querySelectorAll<HTMLFieldSetElement>('.question-row').forEach((row, i) => { row.querySelector('legend')!.textContent = `Gate ${i + 1}`; (row.querySelector('.remove-question') as HTMLButtonElement).disabled = $('question-rows').children.length <= 1 })
    $<HTMLButtonElement>('add-question').disabled = $('question-rows').children.length >= 30
  }
  function addRow(level?: Partial<Level>) {
    const rows = $('question-rows'); if (rows.children.length >= 30) return
    const card = document.createElement('fieldset'); card.className = 'question-row'
    const legend = document.createElement('legend'); card.append(legend)
    const fields = [['name','Level name',level?.name || `Chamber ${rows.children.length + 1}`,70],['question','Question',level?.question || '',3000],['key','Correct answer / accepted alternatives',level?.key || '',1000],['hint','Hint (optional)',level?.hint || '',1000]] as const
    fields.forEach(([name, text, value, max]) => { const label=document.createElement('label');label.textContent=text;const field=document.createElement(name==='question'?'textarea':'input');field.dataset.field=name;field.value=value;field.maxLength=max;field.required=name==='question'||name==='key';if(field instanceof HTMLTextAreaElement)field.rows=2;label.append(field);card.append(label) })
    const remove=document.createElement('button');remove.type='button';remove.className='text-button remove-question';remove.textContent='Remove question';remove.onclick=()=>{card.remove();renumber()};card.append(remove);rows.append(card);renumber()
  }
  $('add-question').onclick=()=>addRow()
  $('close-setup').onclick=()=>dialog.close()
  $('setup-form').onsubmit=e=>{
    e.preventDefault();const levels:Level[]=[]
    document.querySelectorAll<HTMLFieldSetElement>('.question-row').forEach((row,i)=>{const value=(name:string)=>(row.querySelector(`[data-field="${name}"]`) as HTMLInputElement).value.trim();levels.push({name:value('name')||`Chamber ${i+1}`,question:value('question'),key:value('key'),hint:value('hint'),answer:'',completed:false,combatWon:false,chests:[false,false],attempts:0})})
    if(!levels.length||levels.length>30||levels.some(l=>!l.question||!l.key||l.key.split('|').some(k=>!k.trim()))){$('setup-error').textContent='Add 1–30 questions with nonempty answer keys. Remove empty alternatives around |.';return}
    const same=!editingNew&&JSON.stringify(levels.map(l=>[l.question,l.key]))===JSON.stringify(original.levels.map(l=>[l.question,l.key]))
    if(same)levels.forEach((l,i)=>Object.assign(l,{answer:original.levels[i].answer,completed:original.levels[i].completed,combatWon:original.levels[i].combatWon,chests:[...original.levels[i].chests],attempts:original.levels[i].attempts}))
    const updated:Quest={id:editingNew?newId():original.id,hero:$<HTMLInputElement>('hero-name').value.trim()||'The Scholar',title:$<HTMLInputElement>('quest-name').value.trim()||'My Assignment Quest',current:same?original.current:0,levels}
    dialog.close();onSave(updated,editingNew)
  }
  function open(isNew:boolean){original=getQuest();editingNew=isNew;$('editor-title').textContent=isNew?'Your assignment. Your adventure.':'Edit your quest';$<HTMLInputElement>('hero-name').value=original.hero;$<HTMLInputElement>('quest-name').value=isNew?'':original.title;$('question-rows').replaceChildren();if(isNew)addRow();else original.levels.forEach(addRow);$('setup-error').textContent='';dialog.showModal()}
  return {dialog,open,openImported(data:ImportedAssignment){open(true);$('editor-title').textContent=`${data.levels.length} levels ready to play`;$<HTMLInputElement>('quest-name').value=data.title;if(data.hero)$<HTMLInputElement>('hero-name').value=data.hero;$('question-rows').replaceChildren();data.levels.forEach(addRow)}}
}
