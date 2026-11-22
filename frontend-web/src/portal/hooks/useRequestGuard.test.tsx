import {test,expect,vi} from 'vitest';
import {renderHook,act} from '@testing-library/react';
vi.mock('../../auth/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'one'}},context:{membresias:[]}})}));
import {useRequestGuard} from './useRequestGuard';
test('business change and unmount invalidate pending reads',()=>{
 const {result,rerender,unmount}=renderHook(({id})=>useRequestGuard(id),{initialProps:{id:1}});
 let old:any;act(()=>{old=result.current();});expect(old()).toBe(true);
 rerender({id:2});expect(old()).toBe(false);
 let next:any;act(()=>{next=result.current();});expect(next()).toBe(true);
 unmount();expect(next()).toBe(false);
});
