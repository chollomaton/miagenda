import {randomBytes,randomUUID,createHash,generateKeyPairSync} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import type {Transaction} from 'firebase-admin/firestore';
import {canonicalJSON,sha256} from '../src/mirror/canonical';
import {validateManifest,validateSnapshot,validateState} from '../src/mirror/validation';
import type {MirrorState,MirrorGenerationManifest,MirrorEntity,MirrorBucketManifest} from '../src/mirror/contract';
export const PROJECT='demo-miagenda-mirror';
export function assertIsolation(){
 if(process.env.MIAGENDA_EMULATOR!=='1'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099'||process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.GCLOUD_PROJECT&&process.env.GCLOUD_PROJECT!==PROJECT)throw Error('EMULATOR_ISOLATION_REQUIRED');
}
assertIsolation();
// Ephemeral synthetic certificate prevents ADC or metadata discovery. Never persisted.
const syntheticKey=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;
const app=initializeApp({projectId:PROJECT,credential:cert({projectId:PROJECT,clientEmail:'authority@example.test',privateKey:syntheticKey})},'mirror-local-authority');
const db=getFirestore(app);
const root=(owner:string)=>`users/${owner}/icloudMirror/state`;
const control=(owner:string)=>db.doc(`users/${owner}/mirrorControl/grant`);
const identifier=(id:unknown):string=>{if(typeof id!=='string'||!id||id.includes('/')||id.length>200)throw Error('INVALID_ID');return id;};
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export interface WireBundle {state:MirrorState;manifest:MirrorGenerationManifest;objects:Record<string,MirrorEntity>;buckets:Record<string,MirrorBucketManifest>}
interface Grant {ownerUID:string;publisherUID:string;publisherID:string;leaseExpiresAt:Timestamp;revokedAt:Timestamp|null}
function authorized(g:Grant|undefined,uid:string,owner:string,publisherID?:string){if(!g||g.ownerUID!==owner||g.publisherUID!==uid||uid===owner||g.revokedAt!==null||g.leaseExpiresAt.toMillis()<=Date.now()||publisherID&&g.publisherID!==publisherID)throw Error('DENIED');return g;}
export async function authenticate(token:string){assertIsolation();return (await getAuth(app).verifyIdToken(token)).uid;}
export async function checkBundle(b:WireBundle){
 validateManifest(b.manifest);validateState(b.state);const m=b.manifest;
 if(b.state.currentGeneration!==m.generationID||b.state.publisherID!==m.source.publisherID||b.state.rootHash!==m.rootHash||b.state.publishedAt!==m.publishedAt)throw Error('STATE_MANIFEST_MISMATCH');
 identifier(m.generationID);const entities:MirrorEntity[]=[];
 for(const r of m.buckets){const bucket=b.buckets[r.hash];if(!bucket||await sha256(bucket)!==r.hash||bucket.entities.length!==r.entityCount)throw Error('INVALID_BUCKET');for(const ref of bucket.entities){const e=b.objects[ref.hash];if(!e||await sha256(e)!==ref.hash||e.id!==ref.id||e.kind!==ref.kind)throw Error('INVALID_OBJECT');entities.push(e);}}
 const result=await validateSnapshot({manifest:m,entities});if(!result.valid)throw Error('INVALID_SNAPSHOT');
 if(Object.keys(b.objects).length!==entities.length||Object.keys(b.buckets).length!==m.buckets.length)throw Error('EXTRA_CONTENT');
}
export async function begin(uid:string,owner:string){identifier(uid);identifier(owner);if(uid===owner)throw Error('SEPARATE_UID_REQUIRED');const challenge=randomBytes(32).toString('hex');const expiresAt=Timestamp.fromMillis(Date.now()+300000);await db.doc(`mirrorChallenges/${digest(challenge)}`).create({scope:'miagenda-mirror-v1',ownerUID:owner,publisherUID:uid,expiresAt,consumedAt:null,claimedBy:null});return {challenge,expiresAt:expiresAt.toDate().toISOString()};}
async function useChallenge(uid:string,challenge:string,confirm:boolean){if(!/^[0-9a-f]{64}$/.test(challenge))throw Error('INVALID_CHALLENGE');const ref=db.doc(`mirrorChallenges/${digest(challenge)}`);return db.runTransaction(async tx=>{const s=await tx.get(ref),r=s.data();if(!r||r.scope!=='miagenda-mirror-v1'||r.ownerUID!==uid||r.publisherUID===uid||r.consumedAt!==null||r.expiresAt.toMillis()<=Date.now())throw Error('INVALID_CHALLENGE');if(!confirm){tx.update(ref,{claimedBy:uid});return {ownerUID:uid,publisherUID:r.publisherUID};}if(r.claimedBy!==uid)throw Error('CLAIM_REQUIRED');const g:Grant={ownerUID:uid,publisherUID:r.publisherUID,publisherID:randomUUID(),leaseExpiresAt:Timestamp.fromMillis(Date.now()+3600000),revokedAt:null};tx.update(ref,{consumedAt:Timestamp.now()});tx.set(control(uid),g);return {...g,leaseExpiresAt:g.leaseExpiresAt.toDate().toISOString()};});}
export const claim=(uid:string,challenge:string)=>useChallenge(uid,challenge,false);
export const confirm=(uid:string,challenge:string)=>useChallenge(uid,challenge,true);
export async function manage(uid:string,owner:string,publisherID:string,revoke:boolean){identifier(owner);if(uid!==owner)throw Error('DENIED');return db.runTransaction(async tx=>{const s=await tx.get(control(owner)),g=s.data() as Grant|undefined;if(!g||g.publisherID!==publisherID||!revoke&&g.revokedAt!==null)throw Error('STALE_PUBLISHER');tx.update(control(owner),revoke?{revokedAt:Timestamp.now()}:{leaseExpiresAt:Timestamp.fromMillis(Date.now()+3600000)});return {result:revoke?'revoked':'renewed'};});}
async function immutable(uid:string,owner:string,publisherID:string,path:string,payload:unknown){return db.runTransaction(async tx=>{const g=await tx.get(control(owner));authorized(g.data() as Grant|undefined,uid,owner,publisherID);const ref=db.doc(path),old=await tx.get(ref);if(old.exists){if(canonicalJSON(old.data()!.payload)!==canonicalJSON(payload))throw Error('CONTENT_NOT_IMMUTABLE');return 0;}tx.create(ref,{publisherID,payload});return 1;});}
export async function stage(uid:string,owner:string,b:WireBundle,interrupt=false){identifier(owner);await checkBundle(b);const publisherID=b.manifest.source.publisherID;authorized((await control(owner).get()).data() as Grant|undefined,uid,owner,publisherID);let writes=0;for(const [hash,e]of Object.entries(b.objects))writes+=await immutable(uid,owner,publisherID,`${root(owner)}/objects/${hash}`,e);if(interrupt)throw Error('INTERRUPTED');for(const [hash,v]of Object.entries(b.buckets))writes+=await immutable(uid,owner,publisherID,`${root(owner)}/buckets/${hash}`,v);writes+=await immutable(uid,owner,publisherID,`${root(owner)}/generations/${b.manifest.generationID}`,b.manifest);return {writes};}
async function storedBundle(tx:Transaction,owner:string,id:string){identifier(id);const manifest=(await tx.get(db.doc(`${root(owner)}/generations/${id}`))).data()?.payload as MirrorGenerationManifest;validateManifest(manifest);const objects:WireBundle['objects']={},buckets:WireBundle['buckets']={};for(const r of manifest.buckets){const bucket=(await tx.get(db.doc(`${root(owner)}/buckets/${r.hash}`))).data()?.payload as MirrorBucketManifest;if(!bucket)throw Error('INVALID_BUCKET');buckets[r.hash]=bucket;for(const ref of bucket.entities)objects[ref.hash]=(await tx.get(db.doc(`${root(owner)}/objects/${ref.hash}`))).data()?.payload as MirrorEntity;}
 const state:MirrorState={mirrorSchemaVersion:1,currentGeneration:id,previousGeneration:null,publisherID:manifest.source.publisherID,publishedAt:manifest.publishedAt,rootHash:manifest.rootHash};return {state,manifest,objects,buckets};}
export async function activate(uid:string,owner:string,id:string,expected:MirrorState|null){identifier(owner);return db.runTransaction(async tx=>{
 const grantSnapshot=await tx.get(control(owner));const g=grantSnapshot.data() as Grant|undefined;authorized(g,uid,owner);
 const b=await storedBundle(tx,owner,id);await checkBundle(b);authorized(g,uid,owner,b.manifest.source.publisherID);
 const ref=db.doc(root(owner)),s=await tx.get(ref),current=(s.data()??null) as MirrorState|null;
 if(current?.currentGeneration===id&&current.rootHash===b.manifest.rootHash)return {state:current,writes:0};
 if(canonicalJSON(current)!==canonicalJSON(expected))throw Error('POINTER_CONFLICT');
 const state={...b.state,previousGeneration:current?.currentGeneration??null};authorized(g,uid,owner,b.manifest.source.publisherID);tx.set(ref,state);return {state,writes:1};
});}
export async function publish(uid:string,owner:string,b:WireBundle){identifier(owner);await checkBundle(b);authorized((await control(owner).get()).data() as Grant|undefined,uid,owner,b.manifest.source.publisherID);const expected=((await db.doc(root(owner)).get()).data()??null) as MirrorState|null;if(expected?.rootHash===b.manifest.rootHash&&expected.publisherID===b.manifest.source.publisherID)return {result:'unchanged',writes:0,state:expected};const staged=await stage(uid,owner,b);const active=await activate(uid,owner,b.manifest.generationID,expected);return {result:'published',writes:staged.writes+active.writes,state:active.state};}
/** Cleanup is explicit and independent of publish; failed cleanup cannot affect a receipt. */
export async function gc(uid:string,owner:string){identifier(owner);if(uid!==owner)throw Error('DENIED');return db.runTransaction(async tx=>{
 const ref=db.doc(root(owner)),state=(await tx.get(ref)).data() as MirrorState|undefined;
 if(!state)return {result:'collected',deleted:0,blocksPublication:false};
 const generations=await tx.get(ref.collection('generations')),buckets=await tx.get(ref.collection('buckets')),objects=await tx.get(ref.collection('objects'));
 const keepGenerations=new Set([state.currentGeneration,state.previousGeneration].filter(Boolean)),keepBuckets=new Set<string>(),keepObjects=new Set<string>();
 for(const d of generations.docs)if(keepGenerations.has(d.id)){const m=d.data().payload as MirrorGenerationManifest;validateManifest(m);for(const r of m.buckets)keepBuckets.add(r.hash);}
 for(const d of buckets.docs)if(keepBuckets.has(d.id)){const b=d.data().payload as MirrorBucketManifest;for(const r of b.entities)keepObjects.add(r.hash);}
 const doomed=[...generations.docs.filter(d=>!keepGenerations.has(d.id)),...buckets.docs.filter(d=>!keepBuckets.has(d.id)),...objects.docs.filter(d=>!keepObjects.has(d.id))];
 // Bounded cleanup makes progress in small transactions; current/previous are re-read each time.
 for(const d of doomed.slice(0,100))tx.delete(d.ref);
 return {result:'collected',deleted:Math.min(doomed.length,100),blocksPublication:false};
});}

/** Publisher-scoped read for the DEBUG continuous driver; no owner credentials are returned. */
export async function publisherStatus(uid:string,owner:string){identifier(owner);return db.runTransaction(async tx=>{
 const g=authorized((await tx.get(control(owner))).data() as Grant|undefined,uid,owner);
 const state=(await tx.get(db.doc(root(owner)))).data()??null;
 return {grant:{ownerUID:g.ownerUID,publisherUID:g.publisherUID,publisherID:g.publisherID,leaseExpiresAt:g.leaseExpiresAt.toDate().toISOString()},state};
});}
