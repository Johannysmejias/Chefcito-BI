import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Articulo {
  id: number;
  nombre: string;
  tipo: 'MATERIA_PRIMA' | 'SEMI_ELABORADO' | 'PLATO_FINAL';
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  precio_venta?: number;
}

export interface VentaDetalleItem {
  plato_id: number;
  cantidad: number;
}

export interface VentaRequest {
  detalles: VentaDetalleItem[];
}

export interface VentaResponse {
  status: string;
  message: string;
  venta_id: number;
  total_venta: number;
  items_vendidos: number;
}

@Injectable({
  providedIn: 'root'
})
export class VentasService {
  // Configured to point directly to the local FastAPI backend on port 8000
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene la lista de todos los platos finales (PLATO_FINAL) listos para la venta
   */
  getPlatosFinales(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(`${this.apiUrl}/platos/finales`);
  }

  /**
   * Registra una venta en el backend, la cual invocará atómicamente el SP 'registrar_venta_detalle'
   */
  registrarVenta(req: VentaRequest): Observable<VentaResponse> {
    return this.http.post<VentaResponse>(`${this.apiUrl}/ventas`, req);
  }
}
