import type {ReactNode} from 'react';
export function PremiumSurface({children,className='',label}:{children:ReactNode;className?:string;label?:string}) {
 return <section className={'premium-surface '+className} aria-label={label}>{children}</section>;
}
