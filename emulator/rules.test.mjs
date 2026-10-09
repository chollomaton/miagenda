import {readFile} from 'node:fs/promises';
import {after,before,beforeEach,test} from 'node:test';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc,Timestamp,serverTimestamp} from 'firebase/firestore';
let env;
const owner='synthetic-owner',pub='synthetic-publisher';
const root=`users/${owner}/icloudMirror/state`,grantPath=`users/${owner}/mirrorControl/grant`;
const grant={ownerUID:owner,publisherUID:pub,publisherID:'grant-1',revokedAt:null,leaseExpiresAt:Timestamp.fromMillis(Date.now()+3600000)};
const db=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
async function seed(path,value){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),path),value));}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-miagenda-mirror',firestore:{host:'127.0.0.1',port:18080,rules:await readFile(new URL('./firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await seed(grantPath,grant);await seed(root,{currentGeneration:'g1'});});
for(const uid of [owner,pub,'third',null]){
 test(`mirror state read ${uid}`,async()=>{await (uid===owner?assertSucceeds:assertFails)(getDoc(doc(db(uid),root)));});
 test(`mirror state write denied ${uid}`,async()=>{await assertFails(setDoc(doc(db(uid),root),{currentGeneration:'unvalidated'}));});
 test(`editable 1.1 write ${uid}`,async()=>{await (uid===owner?assertSucceeds:assertFails)(setDoc(doc(db(uid),`users/${owner}/entities/task`),{title:'synthetic'}));});
 test(`grant self provisioning denied ${uid}`,async()=>{await assertFails(setDoc(doc(db(uid),grantPath),{...grant,publisherUID:'attacker'}));});
 test(`challenge forged or consumed by client denied ${uid}`,async()=>{await assertFails(setDoc(doc(db(uid),'mirrorChallenges/forged'),{ownerUID:owner,publisherUID:pub,consumedAt:null}));});
}
for(const collection of ['objects','buckets','generations']){
 for(const uid of [owner,pub,'third',null])test(`${collection} create ${uid}`,async()=>{await (uid===pub?assertSucceeds:assertFails)(setDoc(doc(db(uid),`${root}/${collection}/synthetic`),{publisherID:'grant-1',payload:{synthetic:true}}));});
 test(`${collection} immutable and owner-readable`,async()=>{const path=`${root}/${collection}/synthetic`;await seed(path,{publisherID:'grant-1',payload:{synthetic:true}});await assertSucceeds(getDoc(doc(db(owner),path)));await assertFails(getDoc(doc(db('third'),path)));await assertFails(updateDoc(doc(db(pub),path),{payload:{changed:true}}));await assertFails(deleteDoc(doc(db(pub),path)));await assertFails(setDoc(doc(db(pub),`${root}/${collection}/other`),{publisherID:'old-grant',payload:{}}));});
}
test('revocation only by owner',async()=>{await assertFails(updateDoc(doc(db(pub),grantPath),{revokedAt:serverTimestamp()}));await assertFails(updateDoc(doc(db('third'),grantPath),{revokedAt:serverTimestamp()}));await assertSucceeds(updateDoc(doc(db(owner),grantPath),{revokedAt:serverTimestamp()}));await assertFails(setDoc(doc(db(pub),`${root}/objects/after-revoke`),{publisherID:'grant-1',payload:{}}));});
test('expired lease denies stages',async()=>{await seed(grantPath,{...grant,leaseExpiresAt:Timestamp.fromMillis(1)});await assertFails(setDoc(doc(db(pub),`${root}/generations/stale`),{publisherID:'grant-1',payload:{}}));});
test('replacement denies old identity and old publisher ID',async()=>{await seed(grantPath,{...grant,publisherUID:'new-publisher',publisherID:'grant-2'});await assertFails(setDoc(doc(db(pub),`${root}/objects/old`),{publisherID:'grant-1',payload:{}}));await assertFails(setDoc(doc(db('new-publisher'),`${root}/objects/old-id`),{publisherID:'grant-1',payload:{}}));await assertSucceeds(setDoc(doc(db('new-publisher'),`${root}/objects/new`),{publisherID:'grant-2',payload:{}}));});
test('publisher can never extend its own lease',async()=>{await assertFails(updateDoc(doc(db(pub),grantPath),{leaseExpiresAt:Timestamp.fromMillis(Date.now()+7200000)}));await assertFails(updateDoc(doc(db(owner),grantPath),{leaseExpiresAt:Timestamp.fromMillis(Date.now()+7200000)}));});
test('cross owner writes and unknown collections denied',async()=>{await assertFails(setDoc(doc(db(pub),'users/other/icloudMirror/state/objects/a'),{publisherID:'grant-1',payload:{}}));await assertFails(setDoc(doc(db(owner),'users/synthetic-owner/unrecognized/a'),{}));});
