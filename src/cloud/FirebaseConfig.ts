export interface FirebaseConfig {apiKey:string;authDomain:string;projectId:string;appId:string}
export function firebaseConfig(env:Record<string,unknown>):FirebaseConfig|null {
 if(env.VITE_CLOUD_BACKEND!==undefined&&env.VITE_CLOUD_BACKEND!=='firebase')return null;
 const config={apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,appId:env.VITE_FIREBASE_APP_ID};
 if(Object.values(config).some(v=>typeof v!=='string'||!v.trim()||v!==v.trim()))return null;
 if(!/^[a-z0-9][a-z0-9-]*$/.test(String(config.projectId))||!/^([a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+$/.test(String(config.authDomain)))return null;
 return config as FirebaseConfig;
}
export const firebaseScope=(projectId:string,uid:string)=>`firebase:${projectId}:${uid}`;
