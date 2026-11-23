import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
vi.mock('../auth/AuthProvider',()=>({useAuth:()=>({context:{membresias:[{negocio:{id:1,nombre:'Aurora'},status:true,rol_comercio:'dueno'}],negocios:[],sucursales:[]},profile:{correo:'x'},signOut:vi.fn()})}));
import PortalLayout from './PortalLayout';
afterEach(cleanup);
test('mobile drawer exposes state, closes with Escape and restores focus',()=>{
 window.matchMedia=vi.fn().mockReturnValue({matches:true,addEventListener(){},removeEventListener(){}});
 render(<MemoryRouter><PortalLayout/></MemoryRouter>);
 const trigger=screen.getByRole('button',{name:/^Abrir/});
 expect(trigger.getAttribute('aria-expanded')).toBe('false');
 fireEvent.click(trigger);
 expect(trigger.getAttribute('aria-expanded')).toBe('true');
 fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
 expect(trigger.getAttribute('aria-expanded')).toBe('false');
 expect(document.activeElement).toBe(trigger);
});


test('the owner role is presented with a human readable label',()=>{
 window.matchMedia=vi.fn().mockReturnValue({matches:false,addEventListener(){},removeEventListener(){}});
 render(<MemoryRouter initialEntries={['/portal/negocio/1?sucursal=11']}><Routes><Route path="/portal/negocio/:negocioId" element={<PortalLayout/>}/></Routes></MemoryRouter>);
 expect(screen.getByText('Propietario')).toBeTruthy();
 expect(screen.getByRole('link',{name:'Visitas'}).getAttribute('href')).toBe('/portal/negocio/1/visitas?sucursal=11');
});

test('owner navigation groups activity, loyalty, growth and business without losing the branch filter',()=>{
 window.matchMedia=vi.fn().mockReturnValue({matches:false,addEventListener(){},removeEventListener(){}});
 render(<MemoryRouter initialEntries={['/portal/negocio/1?sucursal=11']}><Routes><Route path="/portal/negocio/:negocioId" element={<PortalLayout/>}/></Routes></MemoryRouter>);
 for (const group of ['Actividad','Fidelización','Crecimiento','Tu negocio']) expect(screen.getByText(group)).toBeTruthy();
 expect(screen.getAllByRole('link').filter(link=>link.classList.contains('portal-nav-link'))).toHaveLength(13);
 expect(screen.getByRole('link',{name:'Suscripción'}).getAttribute('href')).toBe('/portal/negocio/1/suscripcion?sucursal=11');
 expect(screen.getByRole('link',{name:'Recompensas'}).getAttribute('href')).toBe('/portal/negocio/1/recompensas?sucursal=11');
 expect(screen.getByRole('link',{name:'Alianzas'}).getAttribute('href')).toBe('/portal/negocio/1/alianzas?sucursal=11');
});
