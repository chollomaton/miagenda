export type IconName='dashboard'|'tasks'|'reminders'|'calendar'|'notes'|'labels'|'completed'|'settings'|'sun'|'check'|'plus'|'search'|'refresh'|'arrow'|'copy'|'sparkles'|'pin'|'menu'|'undo'|'redo'|'trash';
const paths:Record<IconName,string>={
 dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 tasks:'m3 6 1.5 1.5L7 4 M10 6h11 M3 13h3 M10 13h11 M3 20h3 M10 20h11',
 reminders:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
 calendar:'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2 M7 2v5 M17 2v5 M3 9h18 M7 13h1 M12 13h1 M17 13h1 M7 17h1 M12 17h1 M17 17h1',
 notes:'M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7 M10 14l1-4L19 2l3 3-8 8z',
 labels:'M3 3h8l10 10-8 8L3 11z M7 7h.01',
 completed:'M3 3h18v5H3z M5 8v13h14V8 M9 12h6',
 settings:'m9 3 1-2h4l1 2 3 2 2 1 1 4-2 2v3l1 2-3 3-3-1h-3l-2 1-3-3 1-2v-3l-2-2 1-4 2-1z M16 11a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 1v2 M12 21v2 M1 12h2 M21 12h2 M4 4l2 2 M18 18l2 2 M4 20l2-2 M18 6l2-2',
 check:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M7 12l3 3 7-8',
 plus:'M12 5v14 M5 12h14',search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6',refresh:'M19 6a9 9 0 1 0 2 10 M19 2v5h-5',arrow:'M3 12h18 M15 6l6 6-6 6',copy:'M9 8h12v13H9z M15 8V3H3v13h6',sparkles:'m12 2 2 7 7 3-7 2-2 8-2-8-8-2 8-3z',pin:'m9 3 12 12 M7 5l12 12 M8 6 5 14l5 5 8-3 M8 16l-6 6',menu:'M3 4h18v16H3z M9 4v16',undo:'M8 3 2 9l6 6 M2 9h12a7 7 0 0 1 0 14',redo:'m16 3 6 6-6 6 M22 9H10a7 7 0 0 0 0 14',trash:'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7'
};
export function Icon({name,className='',color}:{name:IconName;className?:string;color?:string}){return <svg className={'icon '+className} viewBox="0 0 24 24" fill="none" stroke={color&&/^#[0-9a-f]{6}$/i.test(color)?color:'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>}
