import {expect,test} from 'vitest';
import {safeReturnPath} from './navigation';
test.each([null,'https://attacker.invalid','//attacker.invalid','/\\attacker.invalid','/	/attacker.invalid','/a/..//attacker.invalid'])('rejects unsafe return path %j',value=>{expect(safeReturnPath(value)).toBeNull();});
test.each(['/portal','/portal/negocio/1?sucursal=11#resumen','/invitacion/token'])('preserves internal destination %s',value=>{expect(safeReturnPath(value)).toBe(value);});
