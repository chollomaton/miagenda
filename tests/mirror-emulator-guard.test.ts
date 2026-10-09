import {expect,it} from 'vitest';
import {emulatorAllowed} from '../src/mirror/emulatorDev';
it('emulator requires development, exact loopback and explicit opt-in',()=>{
 expect(emulatorAllowed(true,'127.0.0.1','?mirrorEmulator=1')).toBe(true);
 expect(emulatorAllowed(true,'localhost','?mirrorEmulator=1')).toBe(true);
 for(const host of ['agenda.example.com','127.0.0.1.evil.test','0.0.0.0',''])expect(emulatorAllowed(true,host,'?mirrorEmulator=1')).toBe(false);
 expect(emulatorAllowed(false,'127.0.0.1','?mirrorEmulator=1')).toBe(false);
 for(const query of ['','?mirrorEmulator=true','?mirrorEmulator=0'])expect(emulatorAllowed(true,'127.0.0.1',query)).toBe(false);
});
