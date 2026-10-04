import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';
export function Dialog({label,onClose,children}:{label:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const prior=document.activeElement as HTMLElement|null;const node=ref.current;node?.querySelector<HTMLElement>('input,button,select,textarea,a[href]')?.focus();return ()=>prior?.focus()},[]);
 return <div className="overlay"><div ref={ref} role="dialog" aria-modal="true" aria-label={label} className="search-dialog" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose()}if(e.key==='Tab'){const nodes=ref.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled),textarea,select,a[href]');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}}>{children}</div></div>
}
