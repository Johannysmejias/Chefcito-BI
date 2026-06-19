import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ProduccionCocinaComponent } from './components/produccion-cocina/produccion-cocina.component';
import { PanelComprasComponent } from './components/panel-compras/panel-compras.component';
import { PuntoVentaComponent } from './components/punto-venta/punto-venta.component';
import { DashboardStockComponent } from './components/dashboard-stock/dashboard-stock.component';
import { TurnoControlComponent } from './components/turno-control/turno-control';
import { PlanoMesasComponent } from './components/plano-mesas/plano-mesas.component';
import { ReportesComponent } from './components/reportes/reportes.component';

// 1. IMPORTAR TU SERVICIO DE ARTÍCULOS O INVENTARIO Y HERRAMIENTAS DE RXJS
import { ArticuloService } from './services/articulo.service';
import { MesaService } from './services/mesa.service';
import { Subscription, interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule, // Asegúrate de importar el módulo de HTTP si es necesario
    ProduccionCocinaComponent,
    PanelComprasComponent,
    PuntoVentaComponent,
    DashboardStockComponent,
    TurnoControlComponent,
    PlanoMesasComponent,
    ReportesComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit, OnDestroy { // 2. IMPLEMENTAR ONINIT Y ONDESTROY
  activeTab: string = 'dashboard';

  // 3. DEFINIR VARIABLES DE ESTADO PARA LOS CONTADORES
  cocinaPendientesCount: number = 0;
  comprasTieneAlertas: boolean = false;

  private pollingSub?: Subscription;
  private pedidoMesaSub?: Subscription;

  // 4. INYECTAR EL SERVICIO DE ENLACE DE DATOS
  constructor(
    private articuloService: ArticuloService,
    private mesaService: MesaService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Si desde el Plano de Mesas se elige una mesa para cargarle el pedido, saltamos a Punto de Venta
    this.pedidoMesaSub = this.mesaService.pedidoMesaSeleccionado$.subscribe(() => {
      this.cambiarTab('punto_venta');
    });

    // 5. INICIAR EL POLLING (Cada 10 segundos consulta de manera sutil el inventario)
    this.pollingSub = interval(10000)
      .pipe(
        startWith(0), // Ejecuta la primera petición inmediatamente al cargar
        switchMap(() => this.articuloService.getInventarioCompleto())
      )
      .subscribe({
        next: (inventario) => {
          // A. Filtrar Cocina (SEMI_ELABORADO bajo el stock mínimo)
          const cocinaBajos = inventario.filter(item =>
            item.tipo === 'SEMI_ELABORADO' && item.stock_actual < item.stock_minimo
          );
          this.cocinaPendientesCount = cocinaBajos.length;

          // B. Filtrar Compras (MATERIA_PRIMA bajo el stock mínimo)
          const materiasPrimasBajas = inventario.filter(item =>
            item.tipo === 'MATERIA_PRIMA' && item.stock_actual < item.stock_minimo
          );
          this.comprasTieneAlertas = materiasPrimasBajas.length > 0;

          // Forzar la detección de cambios para actualizar el menú lateral
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.warn('Sincronización silenciosa del menú lateral falló:', err);
        }
      });
  }

  // 6. LIMPIAR LA SUSCRIPCIÓN AL DESTRUIR EL COMPONENTE (Importante para evitar fugas de memoria)
  ngOnDestroy(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
    if (this.pedidoMesaSub) {
      this.pedidoMesaSub.unsubscribe();
    }
  }

  cambiarTab(tabName: string): void {
    this.activeTab = tabName;
    this.cdr.detectChanges();
  }
}
