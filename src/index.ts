import { parseCalendarJson, type CalendarEvent } from './parse.ts';

type PluginApi = { state:unknown; setState:(value:unknown)=>Promise<void>; theme?:'light'|'dark' };
type State = { events: CalendarEvent[] };
type EventRequest = { state?:unknown; from?:string; to?:string };
const STATE_LIMIT = 64 * 1024;
const FILE_LIMIT = 1_000_000;

/** Save only after the entire file and the resulting persisted state pass validation. */
export async function importCalendarFile(file:File, save:(state:State)=>Promise<void>):Promise<number> {
  if(file.size>FILE_LIMIT)throw new Error('The JSON file is too large. The limit is 1 MB.');
  const events=parseCalendarJson(await file.text());
  const state={events};
  if(new TextEncoder().encode(JSON.stringify(state)).byteLength>STATE_LIMIT)throw new Error('The imported event data is too large. The saved data limit is 64 KB.');
  await save(state);
  return events.length;
}

/** Validate persisted data again before handing it to the calendar. */
function savedEvents(state:unknown):CalendarEvent[] {
  if(state===undefined||state===null)return [];
  if(typeof state!=='object'||Array.isArray(state)||!Array.isArray((state as {events?:unknown}).events))throw new Error('Saved calendar data is invalid. Import the JSON file again.');
  const values=(state as {events:unknown[]}).events.map(value=>{
    if(typeof value!=='object'||value===null||Array.isArray(value))return value;
    const item=value as Record<string,unknown>;
    return {id:item.externalId,title:item.title,start:item.start,end:item.end,allDay:item.allDay};
  });
  return parseCalendarJson(JSON.stringify(values));
}

/** Mount a small, accessible import control inside the host's isolated panel. */
function mountPage(container:HTMLElement,api:PluginApi):void {
  const style=document.createElement('style');
  style.textContent=`
    :root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#364356}
    .importer{display:grid;gap:12px;font-size:14px;line-height:1.5}
    .importer h2{margin:0;font-size:15px;line-height:1.3;color:#25344a}
    .importer p{margin:0;color:#65768b;font-size:13px}
    .importer label{font-size:12px;font-weight:650;color:#586b82}
    .importer input{width:100%;max-width:100%;font:inherit;font-size:16px;color:#586b82}
    .importer input::file-selector-button{border:1px solid #d5e0ed;border-radius:7px;background:#f5f8fc;color:#365b8b;padding:8px 10px;margin-right:9px;font:inherit;font-size:13px;cursor:pointer}
    .importer button{justify-self:start;border:0;border-radius:7px;background:#527bb2;color:white;padding:10px 15px;font:inherit;font-size:13px;font-weight:650;cursor:pointer}
    .importer button:disabled{opacity:.45;cursor:not-allowed}
    .importer :focus-visible{outline:2px solid #527bb2;outline-offset:3px}
    .importer .status{min-height:1.5em;color:#4b6f9b;overflow-wrap:anywhere}
    .importer .status.error{color:#a84c46}
    [data-theme="dark"] :root,[data-theme="dark"]{color:#e8eef7}
    [data-theme="dark"] .importer h2{color:#e8eef7}
    [data-theme="dark"] .importer p,[data-theme="dark"] .importer label,[data-theme="dark"] .importer input{color:#c2cddd}
    [data-theme="dark"] .importer input::file-selector-button{background:#303947;border-color:#526177;color:#e2ecfb}
    [data-theme="dark"] .importer .status{color:#a8c9f5}
    [data-theme="dark"] .importer .status.error{color:#ffb4a7}
  `;
  const section=document.createElement('section');section.className='importer';
  const heading=document.createElement('h2');heading.textContent='Import calendar';
  const help=document.createElement('p');help.textContent='Choose a JSON file to replace the events in this calendar. An empty list clears the calendar.';
  const label=document.createElement('label');label.textContent='Calendar JSON file';
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','Calendar JSON file');
  const status=document.createElement('p');status.className='status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const showSavedState=()=>{try{const count=savedEvents(api.state).length;status.classList.remove('error');status.textContent=count?`${count} ${count===1?'event':'events'} imported.`:'No events imported yet.';}catch{status.textContent='Saved data could not be read. Import the file again.';status.classList.add('error');}};
  showSavedState();container.addEventListener('pluginstatechange',showSavedState);
  const button=document.createElement('button');button.type='button';button.textContent='Import events';button.disabled=true;
  input.addEventListener('change',()=>{button.disabled=!input.files?.length;});
  button.addEventListener('click',()=>{void (async()=>{
    const file=input.files?.[0];if(!file)return;button.disabled=true;status.classList.remove('error');status.textContent='Importing…';
    try {const count=await importCalendarFile(file,api.setState);status.textContent=`${count} ${count===1?'event':'events'} imported.`;input.value='';}
    catch(error){status.classList.add('error');status.textContent=error instanceof Error?error.message:'Could not import this file.';}
    finally {button.disabled=!input.files?.length;}
  })();});
  section.append(heading,help,label,input,button,status);container.replaceChildren(style,section);
}

export default {
  mountPage,
  async listEvents({state,from,to}:EventRequest):Promise<CalendarEvent[]> {
    const start=from?Date.parse(from):-Infinity, end=to?Date.parse(to):Infinity;
    return savedEvents(state).filter(event=>Date.parse(event.start)<end&&Date.parse(event.end)>start);
  },
};
