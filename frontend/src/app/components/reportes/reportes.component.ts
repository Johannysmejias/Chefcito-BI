import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReporteService, TurnoReporte, ModalidadReporte, ResumenActual } from '../../services/reporte.service';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css']
})
export class ReportesComponent implements OnInit {
  resumen: ResumenActual | null = null;
  turnos: TurnoReporte[] = [];
  modalidades: ModalidadReporte[] = [];

  desde: string = '';
  hasta: string = '';

  isLoading = false;
  errorMessage = '';

  constructor(private reporteService: ReporteService) {}

  ngOnInit(): void {
    const hoy = new Date();
    const haceUnMes = new Date();
    haceUnMes.setDate(hoy.getDate() - 30);

    this.hasta = this.aFechaInput(hoy);
    this.desde = this.aFechaInput(haceUnMes);

    this.cargarResumenActual();
    this.aplicarFiltro();
  }

  private aFechaInput(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  cargarResumenActual(): void {
    this.reporteService.getResumenActual().subscribe({
      next: (data) => this.resumen = data,
      error: (err) => console.error('Error cargando resumen actual:', err)
    });
  }

  aplicarFiltro(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.reporteService.getReporteTurnos(this.desde, this.hasta).subscribe({
      next: (data) => {
        this.turnos = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'No se pudo cargar el reporte de turnos.';
        this.isLoading = false;
        console.error(err);
      }
    });

    this.reporteService.getReporteModalidades(this.desde, this.hasta).subscribe({
      next: (data) => this.modalidades = data,
      error: (err) => console.error('Error cargando modalidades:', err)
    });
  }

  get totalFacturadoPeriodo(): number {
    return this.turnos.reduce((sum, t) => sum + t.total_facturado, 0);
  }

  get totalPlatosPeriodo(): number {
    return this.turnos.reduce((sum, t) => sum + t.cantidad_platos_vendidos, 0);
  }
}
