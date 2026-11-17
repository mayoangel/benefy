import {test,expect} from 'vitest';
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
