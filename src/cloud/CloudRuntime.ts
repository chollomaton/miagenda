import type {CloudKitConfig} from './CloudKitWebTransport';
import {connectCloudKit} from './connectCloudKitDevelopment';

export interface CloudRuntimeConfig extends CloudKitConfig {authCallback:string;allowedOrigin:string}
type Connection=Awaited<ReturnType<typeof connectCloudKit>>;
type Options=Parameters<typeof connectCloudKit>[2];

/** Inject configuration and a fresh Apple web token at runtime; never persist credentials. */
export class CloudRuntime {
 state:'unavailable'|'signedOut'|'connecting'|'signedIn'='unavailable';
 connection:Connection|null=null;
 private generation=0;
 private config:CloudRuntimeConfig|null=null;
 constructor(config:CloudRuntimeConfig|null|undefined,origin:string){
  try{
   if(!config||!['development','production'].includes(config.environment)||!/^iCloud\.[A-Za-z0-9.-]+$/.test(config.containerIdentifier)||!config.apiToken.trim())return;
   const callback=new URL(config.authCallback),allowed=new URL(config.allowedOrigin);
   if(allowed.origin!==origin||config.allowedOrigin!==allowed.origin||callback.origin!==origin||callback.username||callback.password||callback.hash||callback.search)return;
   if(callback.protocol!=='https:'&&!(callback.protocol==='http:'&&['localhost','127.0.0.1'].includes(callback.hostname)))return;
   this.config={...config};this.state='signedOut';
  }catch{ /* Invalid or absent cloud configuration never prevents local startup. */ }
 }
 async connect(webAuthToken:string,options:Options={}){
  const disconnected=this.disconnect(),generation=this.generation;
  await disconnected;
  if(generation!==this.generation||!this.config||!webAuthToken.trim())return null;
  this.state='connecting';
  try{
   const connection=await connectCloudKit(this.config,webAuthToken,options);
   if(generation!==this.generation){await connection.session.logout();return null}
   this.connection=connection;this.state='signedIn';
   connection.session.auth.onInvalidate(()=>{
    if(this.connection===connection){this.connection=null;this.state='signedOut'}
   });
   return connection;
  }catch{if(generation===this.generation)this.state='unavailable';return null}
 }
 async disconnect(){
  ++this.generation;
  const previous=this.connection;this.connection=null;
  this.state=this.config?'signedOut':'unavailable';
  if(previous)await previous.session.logout();
 }
}
