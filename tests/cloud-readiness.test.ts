import {it,expect,vi} from 'vitest';
import {CloudRuntime} from '../src/cloud/CloudRuntime';
import {CloudKitWebTransport} from '../src/cloud/CloudKitWebTransport';
import {CloudKitRepository,CloudKitGateway} from '../src/cloud/CloudGateway';
import {MemoryPersistence} from '../src/offline/Persistence';
const config={containerIdentifier:'iCloud.test.fixture',apiToken:'synthetic-api',environment:'development' as const,authCallback:'https://agenda.example/callback',allowedOrigin:'https://agenda.example'};
const reply=(body:unknown)=>new Response(JSON.stringify(body));
const request=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('users/current')?reply({userRecordName:'A'}):reply({zones:[{}]}));
it('missing, invalid or wrong-origin config stays unavailable without making requests',async()=>{
 for(const value of [undefined,null,{...config,apiToken:''},{...config,authCallback:'https://other.example/'},{...config,environment:'invalid'}]){
  const runtime=new CloudRuntime(value as typeof config,config.allowedOrigin);
  expect(runtime.state).toBe('unavailable');expect(await runtime.connect('secret',{request})).toBeNull();
 }
 expect(request).not.toHaveBeenCalled();
 const runtime=new CloudRuntime(config,config.allowedOrigin);expect(runtime.state).toBe('signedOut');expect(await runtime.connect('')).toBeNull();
});
it('uses the same connector for Production with isolated storage (mock HTTP only)',async()=>{
 const scopes:string[]=[],urls:string[]=[];
 const runtime=new CloudRuntime({...config,environment:'production'},config.allowedOrigin);
 const connection=await runtime.connect('synthetic-token',{request:async(input)=>{urls.push(String(input));return request(input)},persistence:scope=>{scopes.push(scope);return new MemoryPersistence()}});
 expect(connection?.session.store).toBeTruthy();expect(runtime.state).toBe('signedIn');
 expect(scopes).toEqual(['iCloud.test.fixture:production:A']);expect(urls.every(url=>url.includes('/production/private/'))).toBe(true);
 await runtime.disconnect();expect(runtime.connection).toBeNull();expect(connection?.session.store).toBeNull();
 await expect(connection!.transport.currentUser()).rejects.toMatchObject({code:'authentication'});
});
it('does not attach a connection completing after logout',async()=>{
 let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve});
 const runtime=new CloudRuntime(config,config.allowedOrigin);
 const connected=runtime.connect('synthetic-token',{request:async(input)=>{await pending;return request(input)},persistence:()=>new MemoryPersistence()});
 await Promise.resolve();await runtime.disconnect();release();
 expect(await connected).toBeNull();expect(runtime.connection).toBeNull();expect(runtime.state).toBe('signedOut');
});
it('does not return a private response parsed after invalidation',async()=>{
 let release!:(value:unknown)=>void;const json=new Promise(resolve=>{release=resolve});
 const response=reply({});response.json=()=>json;
 const transport=new CloudKitWebTransport(config,'synthetic-token',async()=>response);
 const user=transport.currentUser();await Promise.resolve();await Promise.resolve();transport.invalidate();
 release({userRecordName:'private-A',ckWebAuthToken:'rotated-secret'});
 await expect(user).rejects.toMatchObject({code:'authentication'});
});
it('redacts network, server and malformed private record errors',async()=>{
 for(const request of [async()=>{throw Error('synthetic-token private-payload')},async()=>reply({serverErrorCode:'UNKNOWN',reason:'synthetic-token private-payload'})]){
  const transport=new CloudKitWebTransport(config,'synthetic-token',request);
  await expect(transport.currentUser()).rejects.toSatisfy((error:Error)=>!String(error).includes('synthetic-token')&&!String(error).includes('private-payload'));
 }
 const transport=new CloudKitWebTransport(config,'synthetic-token',async()=>reply({records:[{recordName:'id',fields:{payloadJSON:{value:'private-payload invalid json'}}}]}));
 const repository=new CloudKitRepository(new CloudKitGateway(transport));
 await expect(repository.fetch('id')).rejects.toMatchObject({message:'invalidRecord'});
 const runtime=new CloudRuntime(config,config.allowedOrigin);
 expect(await runtime.connect('synthetic-token',{request:async()=>{throw Error('private')}})).toBeNull();expect(runtime.state).toBe('unavailable');
});
