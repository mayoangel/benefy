import React from 'react';
import {test,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
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

