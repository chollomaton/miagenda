import {useEffect,useEffectEvent,useRef} from 'react';
import type {Command,CommandId} from './registry';

const urlActions=new Map<string,CommandId>([
 ['new-task','task.new'],['new-reminder','reminder.new'],
 ['new-event','event.new'],['today','calendar.today'],
]);

function isTyping(target:EventTarget|null){
 return target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
}

export function useLaunchActions({ready,commands,blocked,openPalette,closeOverlays}:{ready:boolean;commands:Command[];blocked:boolean;openPalette:()=>void;closeOverlays:()=>void}){
 const consumed=useRef(false);
 const execute=useEffectEvent((id:CommandId)=>commands.find(command=>command.id===id)?.execute());
 useEffect(()=>{
  if(!ready||consumed.current)return;
  consumed.current=true;
  const url=new URL(window.location.href);
  if(!url.searchParams.has('action'))return;
  const id=urlActions.get(url.searchParams.get('action')??'');
  url.searchParams.delete('action');
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
  if(id)execute(id);
 },[ready]);
 const handleKey=useEffectEvent((event:KeyboardEvent)=>{
  if(event.key==='Escape'){closeOverlays();return}
  if(!ready||blocked||event.defaultPrevented||event.repeat||event.isComposing||isTyping(event.target)||!(event.metaKey||event.ctrlKey)||event.altKey)return;
  const key=event.key.toLowerCase();
  if(key==='k'&&!event.shiftKey){event.preventDefault();openPalette();return}
  const id=key==='n'?(event.shiftKey?'reminder.new':'task.new'):key==='e'&&!event.shiftKey?'event.new':undefined;
  const command=id&&commands.find(command=>command.id===id);
  if(command){event.preventDefault();command.execute()}
 });
 useEffect(()=>{
  const listener=(event:KeyboardEvent)=>handleKey(event);
  window.addEventListener('keydown',listener);
  return ()=>window.removeEventListener('keydown',listener);
 },[]);
}
