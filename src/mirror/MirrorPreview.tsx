import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import fixture from '../../tests/fixtures/mirror/full-snapshot.json';
import type {MirrorEntity,MirrorSourceInfo} from './contract';
import {buildGeneration} from './generation';
import {MemoryMirrorCache} from './cache';
import {IsolatedMirrorBackend} from './isolatedBackend';
import {MirrorReader} from './reader';
import {MirrorApp} from './MirrorApp';
/** Dev-only composition with synthetic fixtures. Never a Firebase/iCloud connection. */
export function MirrorPreview({sourceControl}:{sourceControl?:ReactNode}) {
 const [reader,setReader]=useState<MirrorReader|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  let disposed=false;let active:MirrorReader|null=null;let cache:MemoryMirrorCache|null=null;
  async function load(){
   const backend=new IsolatedMirrorBackend();const {challenge}=await backend.begin('synthetic-publisher','synthetic-owner');const grant=await backend.confirm('synthetic-owner',challenge);
   const source={...fixture.source as MirrorSourceInfo,publisherID:grant.publisherID},entities=fixture.entities as MirrorEntity[];
   const generation=await buildGeneration(entities,source,'local-demo-v1','2026-10-08T12:00:00.000Z');
   if(disposed)return;
   cache=new MemoryMirrorCache();
   await backend.publish('synthetic-publisher','synthetic-owner',generation);
   const transport=backend.reader('synthetic-owner','synthetic-owner');
   active=new MirrorReader(transport,cache,source.publisherID,()=>!disposed);await active.boot();await active.refresh();if(!disposed)setReader(active);
  }
  void load().catch(()=>{if(!disposed)setError('No se pudo abrir la vista local.');});
  return ()=>{disposed=true;active?.detach();};
 },[]);
 return reader?<MirrorApp source={reader} sourceControl={sourceControl} demo/>:<main className="login">{sourceControl}<p role={error?'alert':'status'}>{error||'Abriendo copia local de ejemplo…'}</p></main>;
}
