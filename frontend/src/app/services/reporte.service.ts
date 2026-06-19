import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TurnoReporte {
  turno_id: number;
  fecha_apertura: string;
  fecha_cierre: string | null;
  estado: string;
  mesas_ocupadas: number;
  volumen_ventas: number;
  cantidad_platos_vendidos: number;
  total_facturado: number;
  ticket_promedio: number;
  plato_estrella: string;
}

export interface ModalidadReporte {
  modalidad: string;
  volumen_ventas: number;
  total_facturado: number;
  porcentaje_del_total: number;
}

export interface ResumenActual {
  mesas_activas: number;
  mesas_ocupadas: number;
  porcentaje_ocupacion: number;
  ultimo_turno: TurnoReporte | null;
}

@Injectable({
  providedIn: 'root'
})
export class ReporteService {
  private apiUrl = 'https://trend-sermon-slander.ngrok-free.dev/api';

  private headers = new HttpHeaders({
    'ngrok-skip-browser-warning': '69420'
  });

  constructor(private http: HttpClient) {}

  getResumenActual(): Observable<ResumenActual> {
    return this.http.get<ResumenActual>(`${this.apiUrl}/reportes/resumen-actual`, { headers: this.headers });
  }

  getReporteTurnos(desde?: string, hasta?: string): Observable<TurnoReporte[]> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<TurnoReporte[]>(`${this.apiUrl}/reportes/turnos`, { headers: this.headers, params });
  }

  getReporteModalidades(desde?: string, hasta?: string): Observable<ModalidadReporte[]> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<ModalidadReporte[]>(`${this.apiUrl}/reportes/modalidades`, { headers: this.headers, params });
  }
}
