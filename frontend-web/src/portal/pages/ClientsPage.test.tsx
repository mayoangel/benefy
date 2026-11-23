import React from 'react';
import {test,expect,vi} from 'vitest';
import {render,screen,fireEvent,act,cleanup,within} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import ClientsPage from './ClientsPage';
vi.mock('../../auth/AuthProvider',()=>({useAuth:()=>({session:{user:{id:'one'}},context:{membresias:[]}})}));
vi.mock('../../lib/api',()=>({api:{getBusinessClients:vi.fn()}}));
import {api} from '../../lib/api';
test('a late search cannot replace the current result',async()=>{
 let oldResolve:(x:any)=>void=()=>{};
 const data=(name:string)=>({count:1,page:1,page_size:20,results:[{id:1,nombre:name,apellido:'',correo:'x',visitas:1,puntos:1,cupones:1,ultima_visita:null}]});
 vi.mocked(api.getBusinessClients).mockResolvedValue(data('initial'));
 render(<MemoryRouter initialEntries={['/1']}><Routes><Route path="/:negocioId" element={<ClientsPage/>}/></Routes></MemoryRouter>);
 await screen.findByText('initial');
 vi.mocked(api.getBusinessClients).mockImplementation((_id,params)=>params?.buscar==='a'?new Promise(r=>oldResolve=r):Promise.resolve(data('latest')));
 fireEvent.change(screen.getByPlaceholderText('Cliente o correo'),{target:{value:'a'}});
 await act(async()=>{await new Promise(r=>setTimeout(r,400));});
 fireEvent.change(screen.getByPlaceholderText('Cliente o correo'),{target:{value:'ab'}});
 await screen.findByText('latest');
 await act(async()=>{oldResolve(data('obsolete'));});
 expect(screen.queryByText('obsolete')).toBeNull();
 expect(screen.getByText('latest')).toBeTruthy();
 cleanup();
});

test('typing does not issue a request before the debounce delay',async()=>{
 vi.mocked(api.getBusinessClients).mockClear().mockResolvedValue({count:0,page:1,page_size:20,results:[]});
 render(<MemoryRouter initialEntries={['/1']}><Routes><Route path="/:negocioId" element={<ClientsPage/>}/></Routes></MemoryRouter>);
 await screen.findByText('No hay clientes con esos criterios.');
 const baseline=vi.mocked(api.getBusinessClients).mock.calls.length;
 fireEvent.change(screen.getByPlaceholderText('Cliente o correo'),{target:{value:'abc'}});
 expect(vi.mocked(api.getBusinessClients).mock.calls.length).toBe(baseline);
 cleanup();
});

test('los conteos enlazan a visitas y cupones filtrados por correo',async()=>{
 vi.mocked(api.getBusinessClients).mockClear().mockResolvedValue({
  count:1,page:1,page_size:20,results:[{
   id:1,nombre:'Mariana',apellido:'García',correo:'mariana@example.invalid',
   visitas:18,puntos:240,cupones:3,ultima_visita:null,
  }],
 });
 render(
  <MemoryRouter initialEntries={['/portal/negocio/1/clientes?buscar=mariana']}>
   <Routes><Route path="/portal/negocio/:negocioId/clientes" element={<ClientsPage/>}/></Routes>
  </MemoryRouter>,
 );
 const fila=await screen.findByRole('row',{name:/Mariana García/});
 expect(vi.mocked(api.getBusinessClients)).toHaveBeenCalledWith(1,{buscar:'mariana',page:1,page_size:20});
 expect(within(fila).getByRole('link',{name:'18'}).getAttribute('href')).toBe('/portal/negocio/1/visitas?cliente=mariana%40example.invalid');
 expect(within(fila).getByRole('link',{name:'3'}).getAttribute('href')).toBe('/portal/negocio/1/cupones?cliente=mariana%40example.invalid');
 expect((screen.getByPlaceholderText('Cliente o correo') as HTMLInputElement).value).toBe('mariana');
 cleanup();
});
