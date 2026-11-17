let session = sessionStorage.getItem('benefy-test-signed-out') ? null : {access_token:'fixture',user:{id:'owner'}};
let callback;
export const supabase = {auth:{
 getSession:async()=>({data:{session}}),
 onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){if(callback===fn)callback=undefined;}}}};},
 signInWithPassword:async(credentials)=>{
   const response=await fetch('/__test-auth/login',{method:'POST',body:JSON.stringify(credentials)});
   const result=await response.json();
   if(result.data.session){session=result.data.session;callback?.('SIGNED_IN',session);}
   return result;
 },
 signOut:async()=>{session=null;callback?.('SIGNED_OUT',null);}
}};
