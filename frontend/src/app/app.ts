import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProduccionCocinaComponent } from './components/produccion-cocina/produccion-cocina.component';
import { PanelComprasComponent } from './components/panel-compras/panel-compras.component';
import { PuntoVentaComponent } from './components/punto-venta/punto-venta.component';
import { DashboardStockComponent } from './components/dashboard-stock/dashboard-stock.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ProduccionCocinaComponent,
    PanelComprasComponent,
    PuntoVentaComponent,
    DashboardStockComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  activeTab: 'cocina' | 'compras' | 'punto_venta' | 'dashboard' = 'cocina';
}
