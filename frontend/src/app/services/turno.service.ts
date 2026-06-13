import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TurnoService {
  // Recordá cambiar esto por tu URL activa de Ngrok en producción
  private apiUrl = 'http://localhost:8000/api/turnos';

  constructor(private http: HttpClient) {}

  getTurnoActual(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/actual`);
  }

  abrirTurno(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/abrir`, {});
  }

  cerrarTurno(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cerrar`, {});
  }
}
