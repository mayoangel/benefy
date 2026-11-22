import {Component, type ReactNode} from 'react';
export class RouteErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed ? <main className="portal-state portal-state-error" role="alert"><h1>No se pudo abrir esta pantalla</h1><p>Recarga para obtener la versión actual de Benefy.</p><button type="button" onClick={()=>window.location.reload()}>Recargar</button></main>:this.props.children;}
}
