import {test,expect,vi} from 'vitest';
import {readPlan,clearPlanCache} from './planCache';
test('deduplicates in-flight reads and isolates scopes',async()=>{
 clearPlanCache();let calls=0;const load=async()=>{calls++;return {value:calls};};
 const [a,b]=await Promise.all([readPlan('user1:business1',load),readPlan('user1:business1',load)]);
 expect(calls).toBe(1);expect(a).toEqual(b);
 await readPlan('user2:business1',load);expect(calls).toBe(2);
 await readPlan('user1:business2',load);expect(calls).toBe(3);
});
test('logout invalidation prevents an old promise from repopulating cache',async()=>{
 clearPlanCache();let resolve:any;
 const old=readPlan('same',()=>new Promise(r=>resolve=r));clearPlanCache();
 resolve('old');await old;
 expect(await readPlan('same',async()=> 'new')).toBe('new');
});

test('forced reload and expiry replace cached usage',async()=>{
 clearPlanCache();let value=0;const load=async()=>++value;
 expect(await readPlan('scope',load)).toBe(1);
 expect(await readPlan('scope',load)).toBe(1);
 expect(await readPlan('scope',load,true)).toBe(2);
 const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now+16000);
 expect(await readPlan('scope',load)).toBe(3);
 vi.restoreAllMocks();
});
test('an old failed read cannot remove its replacement',async()=>{
 clearPlanCache();let reject:any;
 const old=readPlan('scope',()=>new Promise((_r,j)=>reject=j));const handled=old.catch(()=>null);
 await readPlan('scope',async()=> 'new',true);
 reject(new Error('old failure'));await handled;
 expect(await readPlan('scope',async()=> 'unexpected')).toBe('new');
});
