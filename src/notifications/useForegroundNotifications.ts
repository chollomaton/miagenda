import {useEffect,useState} from 'react';
import type {AgendaStore} from '../stores/AgendaStore';
import {browserPermission,ForegroundNotificationScheduler} from './ForegroundNotificationScheduler';
export function useForegroundNotifications(store:AgendaStore,entered:boolean){
 const [permission,setPermission]=useState(browserPermission);
 const [scheduler]=useState(()=>new ForegroundNotificationScheduler(()=>store.status==='signedOut'||store.status==='booting'?[]:store.entities));
 useEffect(()=>{
  if(!entered)return;
  const refresh=()=>{setPermission(browserPermission());scheduler.refresh()};
  scheduler.start();const unsubscribe=store.subscribe(refresh);
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return ()=>{unsubscribe();scheduler.stop();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[store,entered,scheduler]);
 return {permission,refreshPermission:()=>{setPermission(browserPermission());scheduler.refresh()}};
}
