import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,act,cleanup,fireEvent} from '@testing-library/react';
const mocks=vi.hoisted(()=>({listener:null as any,session:{user:{id:'one'}} as any,context:vi.fn(),profile:vi.fn(),login:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{auth:{signInWithPassword:()=>mocks.login(),getSession:async()=>({data:{session:mocks.session}}),onAuthStateChange:(cb:any)=>{mocks.listener=cb;return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{mocks.session=null;mocks.listener('SIGNED_OUT',null);}}}}));
vi.mock('../lib/api',()=>({ApiError:class extends Error{},api:{getProfile:()=>mocks.profile(),getContext:()=>mocks.context()}}));
import {AuthProvider,useAuth} from './AuthProvider';
const context=(id:number,access=true)=>({usuario:{id},puede_portal:access,es_admin_sistema:false,membresias:access?[{id}]:[],negocios:[],sucursales:[]});
function Probe(){const a=useAuth();return <><output data-profile={a.profile?.id ?? "empty"}>{a.context?.usuario.id??'empty'}:{String(a.context?.puede_portal)}</output><button onClick={()=>void a.refreshContext()}>Refresh</button><button onClick={()=>void a.signOut()}>Logout</button></>}
afterEach(()=>{cleanup();mocks.session={user:{id:'one'}};vi.clearAllMocks();});
async function start(){mocks.profile.mockResolvedValue({id:1});mocks.context.mockResolvedValue(context(1));render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('1:true');}
test('logout discards a context response already in flight',async()=>{await start();let resolve:any;mocks.context.mockImplementationOnce(()=>new Promise(r=>resolve=r));fireEvent.click(screen.getByText('Refresh'));fireEvent.click(screen.getByText('Logout'));await act(async()=>{resolve(context(1));});expect(screen.getByText('empty:undefined')).toBeTruthy();});
test('switching identity discards a previous user response',async()=>{await start();let resolve:any;mocks.context.mockImplementationOnce(()=>new Promise(r=>resolve=r));fireEvent.click(screen.getByText('Refresh'));mocks.context.mockResolvedValue(context(2));await act(async()=>{mocks.listener('SIGNED_IN',{user:{id:'two'}});});await screen.findByText('2:true');await act(async()=>resolve(context(1)));expect(screen.getByText('2:true')).toBeTruthy();});
test('an older context cannot restore revoked permissions',async()=>{await start();let resolve:any;mocks.context.mockImplementationOnce(()=>new Promise(r=>resolve=r));fireEvent.click(screen.getByText('Refresh'));mocks.context.mockResolvedValue(context(1,false));fireEvent.click(screen.getByText('Refresh'));await screen.findByText('1:false');await act(async()=>resolve(context(1)));expect(screen.getByText('1:false')).toBeTruthy();});

test('focus during initial hydration does not lose the profile',async()=>{
 let resolveProfile:any;
 mocks.profile.mockImplementationOnce(()=>new Promise(r=>resolveProfile=r));
 mocks.context.mockResolvedValue(context(1));
 render(<AuthProvider><Probe/></AuthProvider>);
 await act(async()=>{await Promise.resolve();});
 await act(async()=>{window.dispatchEvent(new Event('focus'));});
 await act(async()=>resolveProfile({id:1}));
 await screen.findByText('1:true');
 expect(screen.getByRole('status').getAttribute('data-profile')).toBe('1');
});

test('the login caller awaits the hydration started by SIGNED_IN',async()=>{
 mocks.session=null;
 // Keep this source-level test compatible with the app's ES2020 type library.
 let resolveProfile!: (profile: {id:number}) => void;
 const pendingProfile=new Promise<{id:number}>(resolve=>{resolveProfile=resolve;});
 mocks.profile.mockReturnValue(pendingProfile);
 mocks.context.mockResolvedValue(context(1));
 mocks.login.mockImplementation(async()=>{
  mocks.session={user:{id:'one'}};
  mocks.listener('SIGNED_IN',mocks.session);
  return {data:{session:mocks.session},error:null};
 });
 let result:any='pending';
 function LoginProbe(){const {signIn}=useAuth();return <button onClick={()=>void signIn('owner@example.invalid','synthetic').then(value=>{result=value;})}>Login</button>;}
 render(<AuthProvider><LoginProbe/></AuthProvider>);
 await act(async()=>{await Promise.resolve();});
 await act(async()=>{fireEvent.click(screen.getByText('Login'));});
 expect(result).toBe('pending');
 expect(mocks.profile).toHaveBeenCalledTimes(1);
 await act(async()=>resolveProfile({id:1}));
 expect(result.context.usuario.id).toBe(1);
 expect(result.needsProfile).toBe(false);
});
