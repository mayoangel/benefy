import {useCallback,useEffect,useState} from 'react';
import {useAuth} from '../../auth/AuthProvider';
import {api} from '../../lib/api';
import type {PlanNegocio} from '../../lib/types';
import {useRequestGuard} from './useRequestGuard';
import {readPlan} from './planCache';
export function usePlan(negocioId:number) {
  const {session,context}=useAuth();
  const scope=JSON.stringify([session?.user.id,negocioId,context?.membresias,context?.sucursales,context?.es_admin_sistema]);
  const [snapshot,setSnapshot]=useState<{scope:string;plan:PlanNegocio}|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const guard=useRequestGuard(negocioId);
  const cargar=useCallback(async(force=false)=>{
    const valid=guard();setLoading(true);setError(null);
    try {const plan=await readPlan(scope,()=>api.getBusinessPlan(negocioId),force);if(valid())setSnapshot({scope,plan});}
    catch(e){if(valid())setError(e instanceof Error?e.message:'No se pudo cargar el plan.');}
    finally {if(valid())setLoading(false);}
  },[guard,scope,negocioId]);
  useEffect(()=>{void cargar();},[cargar]);
  const reload=useCallback(()=>cargar(true),[cargar]);
  return {plan:snapshot?.scope===scope?snapshot.plan:null,loading,error,reload};
}
