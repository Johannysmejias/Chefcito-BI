import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

export interface MesaParaPedido {
  id_mesa: number;
  etiqueta_visible: string;
}

@Injectable({
  providedIn: 'root'
})
export class MesaService {
 private apiUrl = 'https://trend-sermon-slander.ngrok-free.dev/api';
  constructor(private http: HttpClient) { }

  // Canal compartido: el Plano de Mesas avisa que se quiere cargar un pedido para una mesa.
  // App (que nunca se destruye) escucha el Subject para cambiar de pestaña. Punto de Venta
  // se crea/destruye con cada cambio de pestaña (*ngIf), así que en vez de depender del
  // timing de la suscripción, lee y consume el valor pendiente en su ngOnInit.
  private pedidoMesaSubject = new Subject<MesaParaPedido>();
  pedidoMesaSeleccionado$ = this.pedidoMesaSubject.asObservable();
  private mesaPendiente: MesaParaPedido | null = null;

  solicitarPedidoParaMesa(mesa: MesaParaPedido): void {
    this.mesaPendiente = mesa;
    this.pedidoMesaSubject.next(mesa);
  }

  consumirMesaPendiente(): MesaParaPedido | null {
    const mesa = this.mesaPendiente;
    this.mesaPendiente = null;
    return mesa;
  }

// ... dentro de tu clase de servicio ...

// 1. Creamos el pase especial para ngrok
private headers = new HttpHeaders({
  'ngrok-skip-browser-warning': '69420' // Cualquier valor funciona para saltar la advertencia
});

// 2. Agregamos los headers a TODAS tus peticiones HTTP
getMesas(): Observable<any> {
  return this.http.get(`${this.apiUrl}/mesas`, { headers: this.headers });
}

guardarLayout(mesas: any): Observable<any> {
  return this.http.post(`${this.apiUrl}/mesas/guardar-layout`, mesas, { headers: this.headers });
}
// En mesa.service.ts

getEstadoVivo(): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}/mesas/estado-vivo`, { headers: this.headers });
}

// 3. Cuentas abiertas por mesa (POS con seguimiento de mesa)

getCuentasAbiertas(): Observable<CuentaAbierta[]> {
  return this.http.get<CuentaAbierta[]>(`${this.apiUrl}/cuentas/abiertas`, { headers: this.headers });
}

abrirCuenta(mesaId: number): Observable<Cuenta> {
  return this.http.post<Cuenta>(`${this.apiUrl}/mesas/${mesaId}/cuenta`, {}, { headers: this.headers });
}

obtenerCuenta(ventaId: number): Observable<Cuenta> {
  return this.http.get<Cuenta>(`${this.apiUrl}/cuentas/${ventaId}`, { headers: this.headers });
}

agregarItemsCuenta(ventaId: number, detalles: { plato_id: number, cantidad: number }[]): Observable<Cuenta> {
  return this.http.post<Cuenta>(`${this.apiUrl}/cuentas/${ventaId}/items`, { detalles }, { headers: this.headers });
}

cerrarCuenta(ventaId: number): Observable<Cuenta> {
  return this.http.post<Cuenta>(`${this.apiUrl}/cuentas/${ventaId}/cerrar`, {}, { headers: this.headers });
}
}

export interface CuentaItem {
  plato_id: number;
  plato_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Cuenta {
  venta_id: number;
  mesa_id: number;
  estado: 'ABIERTA' | 'COBRADA';
  total: number;
  items: CuentaItem[];
}

export interface CuentaAbierta {
  venta_id: number;
  mesa_id: number;
  etiqueta_visible: string;
  total: number;
}
