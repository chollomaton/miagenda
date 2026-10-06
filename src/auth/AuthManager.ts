export type AuthState='checking'|'signedOut'|'signingIn'|'signedIn'|'signingOut'|'expired'|'error';
export interface AuthProvider {check?():Promise<string|null>;signIn():Promise<string|null>;signOut():Promise<void>}
export class AuthManager {
 generation=0; identity:string|null=null;state:AuthState='signedOut'; private cleanup=new Set<()=>void>();
 constructor(private provider:AuthProvider){}
 onInvalidate(fn:()=>void){this.cleanup.add(fn);return ()=>{this.cleanup.delete(fn)}}
 valid(generation:number){return generation===this.generation&&this.state==='signedIn'}
 async check(){const g=++this.generation;this.identity=null;this.cleanup.forEach(fn=>fn());this.state='checking';try{const id=await this.provider.check?.()??null;if(g!==this.generation)return;this.identity=id;this.state=id?'signedIn':'signedOut'}catch{if(g===this.generation)this.state='error'}}
 async signIn(){const g=++this.generation;this.identity=null;this.cleanup.forEach(fn=>fn());this.state='signingIn';try{const id=await this.provider.signIn();if(g!==this.generation)return;this.identity=id;this.state=id?'signedIn':'signedOut'}catch{if(g===this.generation)this.state='error'}}
 async signOut(){const g=++this.generation;this.identity=null;this.state='signingOut';this.cleanup.forEach(fn=>fn());try{await this.provider.signOut()}finally{if(g===this.generation)this.state='signedOut'}}
 expire(){++this.generation;this.identity=null;this.state='expired';this.cleanup.forEach(fn=>fn())}
}
export const localAuth=()=>new AuthManager({signIn:async()=> 'local-workspace',signOut:async()=>{}});

/** The host supplies an authenticated CloudKit JS container; this adapter never loads SDKs or credentials. */
export interface CloudKitAuthGateway {setUpAuth():Promise<{userRecordName:string}|null>;requestSignIn():Promise<{userRecordName:string}|null>;requestSignOut():Promise<void>}
export class CloudKitAuthProvider implements AuthProvider {
 constructor(private gateway:CloudKitAuthGateway){}
 async check(){return (await this.gateway.setUpAuth())?.userRecordName??null}
 async signIn(){const user=await this.gateway.setUpAuth()??await this.gateway.requestSignIn();return user?.userRecordName??null}
 async signOut(){await this.gateway.requestSignOut()}
}

export class MockAuthProvider implements AuthProvider {identity:string|null=null;constructor(private userID="synthetic-user"){}async check(){return this.identity}async signIn(){this.identity=this.userID;return this.identity}async signOut(){this.identity=null}}
