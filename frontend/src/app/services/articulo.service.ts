import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; // <-- Agregado HttpHeaders acá
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

export interface ProduccionRequest {
  semi_id: number;
  cantidad: number;
}

export interface ProduccionResponse {
  status: string;
  message: string;
  articulo: {
    id: number;
    nombre: string;
    stock_actual: number;
    stock_minimo: number;
    sigue_bajo_minimo: boolean;
  };
}

export interface VentaItem {
  plato_id: number;
  cantidad: number;
}

export interface VentaRequest {
  detalles: VentaItem[];
}

export interface VentaResponse {
  status: string;
  message: string;
  venta_id: number;
  total_venta: number;
  items_vendidos: number;
}

export interface ProduccionLog {
  id: number;
  semi_id: number;
  semi_nombre: string;
  cantidad: number;
  fecha: string;
}

export interface VentaLog {
  id: number;
  venta_id: number;
  plato_id: number;
  plato_nombre: string;
  cantidad: number;
  fecha: string;
  total_venta: number;
}

@Injectable({
  providedIn: 'root'
})
export class ArticuloService {
  // Ajustar URL segun el entorno de despliegue
  private apiUrl = 'https://trend-sermon-slander.ngrok-free.dev/api';

  // Configuración de la cabecera para evitar la pantalla de Ngrok
  private headers = new HttpHeaders({
    'ngrok-skip-browser-warning': 'true'
  });

  constructor(private http: HttpClient) {}

  /**
   * Obtiene los articulos de cocina de tipo SEMI_ELABORADO con stock < stock_minimo
   */
  getArticulosCocina(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(`${this.apiUrl}/articulos/cocina`, { headers: this.headers });
  }

  /**
   * Registra produccion cocinada para un articulo SEMI_ELABORADO
   */
  registrarProduccion(req: ProduccionRequest): Observable<ProduccionResponse> {
    return this.http.post<ProduccionResponse>(`${this.apiUrl}/produccion`, req, { headers: this.headers });
  }

  registrarCompraInsumo(materia_prima_id: number, cantidad: number): Observable<any> {
  const req = { materia_prima_id, cantidad };
  return this.http.post<any>(`${this.apiUrl}/compras`, req, { headers: this.headers });
}

  /**
   * Obtiene todas las MATERIAS_PRIMAS para el Panel de Compras
   */
  getMateriasPrimas(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(`${this.apiUrl}/articulos/materia_prima`, { headers: this.headers });
  }

  /**
   * Obtiene los PLATOS_FINALES para el Módulo de Punto de Venta
   */
  getPlatosFinales(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(`${this.apiUrl}/articulos/plato_final`, { headers: this.headers });
  }

  /**
   * Registra venta de platos e inserta detalles ejecutando el descargo del BOM
   */
  registrarVenta(req: VentaRequest): Observable<VentaResponse> {
    return this.http.post<VentaResponse>(`${this.apiUrl}/ventas`, req, { headers: this.headers });
  }

  /**
   * Obtiene la planilla de inventario completo
   */
  getInventarioCompleto(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(`${this.apiUrl}/dashboard/inventario`, { headers: this.headers });
  }

  /**
   * Obtiene historial de logs de produccion de cocina
   */
  getHistorialProduccion(): Observable<ProduccionLog[]> {
    return this.http.get<ProduccionLog[]>(`${this.apiUrl}/dashboard/historial-produccion`, { headers: this.headers });
  }

  /**
   * Obtiene historial de logs de ventas
   */
  getHistorialVentas(): Observable<VentaLog[]> {
    return this.http.get<VentaLog[]>(`${this.apiUrl}/dashboard/historial-ventas`, { headers: this.headers });
  }
}
