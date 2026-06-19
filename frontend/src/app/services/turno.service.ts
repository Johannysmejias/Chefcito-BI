import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TurnoService {
  // Recordá cambiar esto por tu URL activa de Ngrok en producción
  private apiUrl = 'https://trend-sermon-slander.ngrok-free.dev/api';

  constructor(private http: HttpClient) {}
  private headers = new HttpHeaders({
  'ngrok-skip-browser-warning': '69420' // Cualquier valor funciona para saltar la advertencia
});

  getTurnoActual(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/turnos/actual`, { headers: this.headers });
  }

  abrirTurno(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/turnos/abrir`, {}, { headers: this.headers });
  }

  cerrarTurno(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/turnos/cerrar`, {}, { headers: this.headers });
  }
}
