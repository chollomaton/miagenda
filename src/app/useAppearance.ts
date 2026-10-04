import {useEffect} from 'react';
import type {Fields} from '../models/entities';

/** Preferences remains the sole source of truth; no additional storage or migration. */
export function useAppearance(theme:Fields['theme'],density:Fields['density']){
 useEffect(()=>{
  document.documentElement.dataset.theme=theme;
  document.documentElement.dataset.density=density;
  const media=window.matchMedia?.('(prefers-color-scheme: dark)');
  const update=()=>document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'||theme==='system'&&media?.matches?'#1e1e1e':'#f5f5f7');
  update();media?.addEventListener('change',update);
  return ()=>media?.removeEventListener('change',update);
 },[theme,density]);
}
