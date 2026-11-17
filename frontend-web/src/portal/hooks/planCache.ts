// Only short-lived plan reads are cached; authorization and operational lists never persist.
const entries = new Map<string, {expires:number; promise:Promise<unknown>}>();
export function clearPlanCache() { entries.clear(); }
export function readPlan<T>(key:string, load:()=>Promise<T>, force=false):Promise<T> {
  const cached=entries.get(key);
  if (!force && cached && cached.expires>Date.now()) return cached.promise as Promise<T>;
  if (entries.size>=20) entries.delete(entries.keys().next().value!);
  const promise=load();
  const entry={expires:Date.now()+15000,promise};
  entries.set(key,entry);
  void promise.catch(()=>{if(entries.get(key)===entry) entries.delete(key);});
  return promise;
}
