import type { Level } from './assignments'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
export interface ImportedAssignment { title:string; hero?:string; levels:Level[] }
const MAX_QUESTIONS=30
function level(question:unknown,key:unknown,name:unknown,hint:unknown,index:number):Level{
  const text=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v).trim():''
  const q=text(question),answer=text(key)
  if(!q||!answer)throw Error(`Question ${index+1} needs both a question and a correct answer.`)
  if(q.length>3000||answer.length>1000||answer.split('|').some(a=>!a.trim()))throw Error(`Question ${index+1} has an invalid or overly long answer key.`)
  return{name:text(name).slice(0,70)||`Gate ${index+1}`,question:q,key:answer,hint:text(hint).slice(0,1000),answer:'',completed:false,combatWon:false,chests:[false,false],attempts:0}
}
function checked(result:ImportedAssignment):ImportedAssignment{
  if(!result.levels.length)throw Error('No question–answer pairs found. Include Q1: … and Answer: …, or use the sample file.')
  if(result.levels.length>MAX_QUESTIONS)throw Error('Use up to 30 questions in one assignment. Nothing has been imported yet.')
  result.title=result.title.trim().slice(0,80)||'Imported assignment';return result
}
function csvRows(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell.trim());cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell=''}else cell+=c}
 if(quoted)throw Error('CSV contains an unclosed quote. Use the sample CSV layout.')
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows
}
function fromCsv(text:string,title:string):ImportedAssignment{
 const rows=csvRows(text.replace(/^\uFEFF/,''));const head=(rows.shift()||[]).map(x=>x.toLowerCase().replace(/[ -]+/g,'_'))
 const find=(...keys:string[])=>head.findIndex(h=>keys.includes(h));const qi=find('question','q'),ki=find('answer','key','correct_answer'),ni=find('level','level_name','name'),hi=find('hint')
 if(qi<0||ki<0)throw Error('CSV needs question and answer column headers. Download the sample to see the layout.')
 return checked({title,levels:rows.map((r,i)=>level(r[qi],r[ki],r[ni],r[hi],i))})
}
function fromJson(text:string,title:string):ImportedAssignment{
 let data:any;try{data=JSON.parse(text)}catch{throw Error('This JSON file is not valid. Check its commas and quotes.')}
 const items=Array.isArray(data)?data:data.questions||data.levels
 if(!Array.isArray(items))throw Error('JSON needs a questions array containing question and answer fields. Use Import quests for a full backup.')
 return checked({title:typeof data.title==='string'?data.title:title,hero:typeof data.hero==='string'?data.hero.slice(0,40):undefined,levels:items.map((item:any,i:number)=>level(item?.question,item?.key??item?.correctAnswer??item?.answer,item?.name??item?.levelName,item?.hint,i))})
}
function numbered(text:string){
 const items:{number:number,text:string}[]=[]
 for(const line of text.split('\n')){const match=line.match(/^\s*(?:Q(?:uestion)?\s*)?(\d+)\s*[).:\-]\s*(.*)$/i);if(match)items.push({number:Number(match[1]),text:match[2].trim()});else if(items.length&&line.trim())items[items.length-1].text+=' '+line.trim()}
 return items
}
export function parseAssignmentText(text:string,title='Imported assignment'):ImportedAssignment{
 text=text.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/^\uFEFF/,'').trim()
 const sections=text.split(/^\s*(?:answer\s*key|answers|solutions)\s*:?\s*$/im)
 if(sections.length===2){const questions=numbered(sections[0]),answers=numbered(sections[1]);const map=new Map(answers.map(a=>[a.number,a.text]));return checked({title,levels:questions.map((q,i)=>level(q.text,map.get(q.number),'','',i))})}
 const pairs:{q:string,a:string,hint:string,name:string}[]=[];let current:{q:string,a:string,hint:string,name:string}|undefined
 for(const raw of text.split('\n')){
  const line=raw.trim();if(!line)continue
  const q=line.match(/^(?:Q(?:uestion)?\s*\d*\s*[).:\-]\s*|\d+\s*[).]\s*)(.+)$/i)
  const a=line.match(/^(?:A(?:nswer|ns)?\s*\d*\s*[).:\-]\s*)(.*)$/i)
  if(q){current={q:q[1],a:'',hint:'',name:''};pairs.push(current);const inline=current.q.match(/^(.*?)\s+(?:Answer|Ans)\s*:\s*(.+)$/i);if(inline){current.q=inline[1];current.a=inline[2]}}
  else if(a&&current)current.a=a[1]
  else if(/^Hint\s*:/i.test(line)&&current)current.hint=line.replace(/^Hint\s*:\s*/i,'')
  else if(/^Level\s*:/i.test(line)&&current)current.name=line.replace(/^Level\s*:\s*/i,'')
  else if(current){if(current.a)current.a+=' '+line;else current.q+=' '+line}
 }
 return checked({title,levels:pairs.map((p,i)=>level(p.q,p.a,p.name,p.hint,i))})
}
export async function readAssignmentFile(file:File):Promise<ImportedAssignment>{
 if(file.size>10_000_000)throw Error('Use a file smaller than 10 MB.')
 const ext=file.name.split('.').pop()?.toLowerCase(),title=file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ')
 if(ext==='json')return fromJson(await file.text(),title)
 if(ext==='csv')return fromCsv(await file.text(),title)
 if(ext==='txt')return parseAssignmentText(await file.text(),title)
 if(ext==='docx'){
  try{const mammoth=await import('mammoth');const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return parseAssignmentText(result.value,title)}catch(error){if(error instanceof Error&&/Question|pairs|questions/.test(error.message))throw error;throw Error('Could not read this Word file. Use a valid .docx with questions and answer keys.')}
 }
 if(ext==='pdf'){
  const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=workerUrl
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())})
  try{
   const doc=await task.promise
   if(doc.numPages>30)throw Error('Use a PDF with 30 pages or fewer.')
   let text=''
   for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const content=await page.getTextContent();text+=content.items.map(item=>'str'in item?item.str+(item.hasEOL?'\n':' '):'').join('')+'\n'}
   if(text.trim().length<10)throw Error('This looks like a scanned PDF. Use a searchable PDF, Word file or the text template; image OCR is not included.')
   return parseAssignmentText(text,title)
  }catch(error){if(error instanceof Error&&/Question|pairs|questions|scanned|30 pages/.test(error.message))throw error;throw Error('Could not read this PDF. Check that it is searchable and not password protected.')}
  finally{await task.destroy()}
 }
 throw Error('Choose a PDF, DOCX, TXT, CSV or JSON assignment with questions and correct answers.')
}
