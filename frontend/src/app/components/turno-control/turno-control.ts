import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TurnoService } from '../../services/turno.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-turno-control',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './turno-control.html'
})
export class TurnoControlComponent implements OnInit {
  turnoActivo: any = null;
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  reporteCierre: any = null;

  constructor(
    private turnoService: TurnoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.verificarEstadoCaja();
  }

  verificarEstadoCaja(): void {
    this.turnoService.getTurnoActual().subscribe({
      next: (res) => {
        this.turnoActivo = res.turno;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error al verificar turno:', err)
    });
  }

  abrirCaja(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.reporteCierre = null;

    this.turnoService.abrirTurno().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = '¡Caja y turno abiertos con éxito! Ya puedes operar el punto de venta.';
        this.verificarEstadoCaja();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || 'No se pudo abrir el turno operativo.';
        this.cdr.detectChanges();
      }
    });
  }

  cerrarCaja(): void {
    if (!confirm('¿Estás seguro de que deseas cerrar el turno? Se congelarán las ventas, se enviará el Reporte Z y la lista de compras prioritarias.')) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.turnoService.cerrarTurno().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.turnoActivo = null;
        this.reporteCierre = res; // Recibimos el JSON analítico de Python
        this.successMessage = '¡Turno finalizado con éxito! El reporte consolidado fue enviado a automatización.';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || 'Error crítico al procesar el cierre Z.';
        this.cdr.detectChanges();
      }
    });
  }
}
