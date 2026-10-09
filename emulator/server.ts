import {createServer} from 'node:http';
import {authenticate,begin,claim,confirm,manage,stage,activate,publish,gc,publisherStatus,assertIsolation} from './authority';
import type {WireBundle} from './authority';
assertIsolation();
const server=createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)){res.writeHead(403).end();return;}
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 try{
  if(req.method!=='POST')throw Error('POST_REQUIRED');
  const uid=await authenticate((req.headers.authorization??'').replace(/^Bearer /,''));
  let body='';for await(const chunk of req){body+=chunk;if(body.length>8000000)throw Error('BODY_LIMIT');}
  const data=JSON.parse(body);let result:unknown;
  switch(req.url){
   case '/status':result=await publisherStatus(uid,data.ownerUID);break;
   case '/begin':result=await begin(uid,data.ownerUID);break;
   case '/claim':result=await claim(uid,data.challenge);break;
   case '/confirm':result=await confirm(uid,data.challenge);break;
   case '/revoke':case '/renew':result=await manage(uid,data.ownerUID,data.publisherID,req.url==='/revoke');break;
   case '/stage':result=await stage(uid,data.ownerUID,data.bundle as WireBundle,data.interrupt===true);break;
   case '/activate':result=await activate(uid,data.ownerUID,data.generationID,data.expected);break;
   case '/publish':result=await publish(uid,data.ownerUID,data.bundle as WireBundle);break;
   case '/gc':result=await gc(uid,data.ownerUID);break;
   default:throw Error('UNKNOWN_OPERATION');
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
 }catch(error){
  const known=new Set(['DENIED','INVALID_SNAPSHOT','POINTER_CONFLICT','STATE_MANIFEST_MISMATCH','INVALID_BUCKET','INVALID_OBJECT','EXTRA_CONTENT','INVALID_CHALLENGE','CLAIM_REQUIRED']);
  const code=error instanceof Error&&known.has(error.message)?error.message:'LOCAL_OPERATION_REJECTED';
  process.stderr.write('Mirror authority status='+code+'\n');
  res.writeHead(403,{'Content-Type':'application/json'}).end('{"error":"LOCAL_OPERATION_REJECTED"}');}
});
server.listen(18081,'127.0.0.1',()=>process.stdout.write('Mirror synthetic authority: 127.0.0.1:18081\n'));
