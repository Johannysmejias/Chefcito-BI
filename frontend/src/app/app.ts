import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProduccionCocinaComponent } from './components/produccion-cocina/produccion-cocina.component';
import { PanelComprasComponent } from './components/panel-compras/panel-compras.component';
import { PuntoVentaComponent } from './components/punto-venta/punto-venta.component';
import { DashboardStockComponent } from './components/dashboard-stock/dashboard-stock.component';
import { TurnoControlComponent } from './components/turno-control/turno-control';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ProduccionCocinaComponent,
    PanelComprasComponent,
    PuntoVentaComponent,
    DashboardStockComponent,
    TurnoControlComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  activeTab: string = 'dashboard';

  constructor(private cdr: ChangeDetectorRef) {}


  cambiarTab(tabName: string): void {
    this.activeTab = tabName;
    this.cdr.detectChanges();
  }
}
