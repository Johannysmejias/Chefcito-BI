import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { Subscription, interval } from 'rxjs'; // <-- Agregamos interval aquí
import { switchMap } from 'rxjs/operators';    // <-- Agregamos switchMap aquí
import { MesaService } from '../../services/mesa.service';

export interface MesaLayout {
  id_mesa: number | null;
  etiqueta_visible: string;
  pos_x: number;
  pos_y: number;
  activa: boolean;
  estado_actual?: 'libre' | 'no_atendida' | 'atendida' | 'esperando_pago' | 'limpieza';
  posicion_cdk?: { x: number, y: number };
}

@Component({
  selector: 'app-plano-mesas',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './plano-mesas.component.html',
  styleUrls: ['./plano-mesas.component.css']
})
export class PlanoMesasComponent implements OnInit, OnDestroy {
  mesas: MesaLayout[] = [];
  showToast: boolean = false;
  toastMessage: string = '';
  mesaArrastrandoId: number | null = null;

  private radarSubscription: Subscription | undefined;
  private dataSubscription: Subscription | undefined; // <-- Faltaba declarar esta variable

  constructor(private mesaService: MesaService) {}

  ngOnInit(): void {
    this.actualizarRadar();

    this.radarSubscription = interval(5000).pipe(
      switchMap(() => this.mesaService.getEstadoVivo())
    ).subscribe({
      next: (data: any[]) => {
        // LÓGICA BLINDADA: Solo actualizamos el color de las mesas que ya están en pantalla
        // Así evitamos que se te muevan solas mientras las estás arrastrando sin guardar.
        data.forEach(mesaViva => {
          const mesaEnPantalla = this.mesas.find(m => m.id_mesa === mesaViva.id_mesa);
          if (mesaEnPantalla) {
            mesaEnPantalla.estado_actual = mesaViva.estado_actual;
            mesaEnPantalla.activa = mesaViva.activa;
          }
        });
      },
      error: (err) => {
        console.error('Error en el radar de tiempo real:', err);
      }
    });
  }

  actualizarRadar(): void {
    this.mesaService.getEstadoVivo().subscribe({
      next: (data) => {
        this.mesas = data.map((mesa: any) => ({ ...mesa, isNew: false }));
      },
      error: (err) => console.error('Error inicial:', err)
    });
  }

  ngOnDestroy(): void {
    if (this.radarSubscription) this.radarSubscription.unsubscribe();
    if (this.dataSubscription) this.dataSubscription.unsubscribe();
  }

  loadMesasData(): void {
    this.dataSubscription = this.mesaService.getMesas().subscribe({
      next: (data: any[]) => {
        this.mesas = data.map((mesa: any) => ({
          ...mesa,
          isNew: false,
          posicion_cdk: { x: mesa.pos_x, y: mesa.pos_y }
        }));
      },
      error: (err) => {
        console.error('Error cargando mesas:', err);
      }
    });
  }

  onMesaClick(mesa: MesaLayout): void {
    if (!mesa.activa || !mesa.id_mesa || mesa.id_mesa < 0) return;
    this.mesaService.solicitarPedidoParaMesa({ id_mesa: mesa.id_mesa, etiqueta_visible: mesa.etiqueta_visible });
  }

  onDragStarted(mesa: MesaLayout): void {
    this.mesaArrastrandoId = mesa.id_mesa;
  }

  onDragEnded(event: CdkDragEnd, mesa: MesaLayout): void {
    const GRID = 30; // mismo paso que la grilla de puntos del fondo
    mesa.pos_x = Math.max(0, Math.round((mesa.pos_x + event.distance.x) / GRID) * GRID);
    mesa.pos_y = Math.max(0, Math.round((mesa.pos_y + event.distance.y) / GRID) * GRID);
    event.source.reset();
    this.mesaArrastrandoId = null;
    console.log(`Mesa movida a X: ${mesa.pos_x}, Y: ${mesa.pos_y}`);
  }

  agregarMesa(): void {
    const tempId = -1 * (this.mesas.filter(m => m.id_mesa && m.id_mesa < 0).length + 1);
    const offset = this.mesas.length * 20;

    const nuevaMesa: MesaLayout = {
      id_mesa: tempId,
      etiqueta_visible: `Mesa Nueva ${Math.abs(tempId)}`,
      pos_x: 50 + offset,
      pos_y: 50 + offset,
      activa: true,
      estado_actual: 'libre',
      posicion_cdk: { x: 50 + offset, y: 50 + offset }
    };

    this.mesas.push(nuevaMesa);
  }

  eliminarMesa(event: MouseEvent, mesa: MesaLayout): void {
    event.stopPropagation();
    const estaSegura = window.confirm(`¿Estás segura de que deseas eliminar la ${mesa.etiqueta_visible}?`);

    if (estaSegura) {
      this.mesas = this.mesas.filter(m => m.id_mesa !== mesa.id_mesa);
      console.log(`Mesa eliminada visualmente: ${mesa.etiqueta_visible}. Recuerda presionar Guardar.`);
    }
  }

  obtenerNumeroMesa(etiqueta: string): string {
    return etiqueta.replace(/\D/g, '') || etiqueta;
  }

  guardarDistribucion(): void {
    console.log('Iniciando guardado de distribución...', this.mesas);
    this.showSuccessToast('Guardando distribución...');

    this.mesaService.guardarLayout(this.mesas).subscribe({
      next: (response) => {
        console.log('Layout guardado exitosamente:', response);
        this.actualizarRadar(); // Recargamos usando el radar para traer los nuevos estados
        this.showSuccessToast('Distribución guardada correctamente en la base de datos.');
      },
      error: (err) => {
        console.error('Error guardando layout:', err);
        this.showErrorToast('Hubo un error al guardar. Inténtalo de nuevo.');
      }
    });
  }

  private showSuccessToast(message: string): void {
    this.toastMessage = message;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }

  private showErrorToast(message: string): void {
    this.toastMessage = message;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 5000);
  }

  trackByMesa(index: number, mesa: MesaLayout): number | null {
    return mesa.id_mesa;
  }
}
