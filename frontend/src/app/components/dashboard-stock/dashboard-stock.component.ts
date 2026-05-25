import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // <-- 1. Importamos ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Articulo, ArticuloService, ProduccionLog, VentaLog } from '../../services/articulo.service';

@Component({
  selector: 'app-dashboard-stock',
  templateUrl: './dashboard-stock.component.html',
  styleUrls: ['./dashboard-stock.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class DashboardStockComponent implements OnInit {
  inventarioCompleto: Articulo[] = [];
  historialProduccion: ProduccionLog[] = [];
  historialVentas: VentaLog[] = [];

  isLoading = false;
  activeSubTab: 'inventario' | 'produccion' | 'ventas' = 'inventario';
  errorMessage = '';

  // 2. Lo inyectamos acá en el constructor
  constructor(
    private articuloService: ArticuloService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarDashboard();
  }

  cargarDashboard(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // Ejecutar consultas
    this.articuloService.getInventarioCompleto().subscribe({
      next: (inv) => {
        this.inventarioCompleto = inv;

        // Cargar historial de produccion
        this.articuloService.getHistorialProduccion().subscribe({
          next: (prod) => {
            this.historialProduccion = prod;

            // Cargar historial de ventas
            this.articuloService.getHistorialVentas().subscribe({
              next: (vta) => {
                this.historialVentas = vta;
                this.isLoading = false;

                // 👇 3. MAGIA: Le gritamos a la pantalla que termine de cargar
                this.cdr.detectChanges();
              },
              error: (err) => {
                this.errorMessage = 'Error al cargar historial de ventas.';
                this.isLoading = false;
                this.cdr.detectChanges(); // También en los errores
              }
            });
          },
          error: (err) => {
            this.errorMessage = 'Error al cargar historial de produccion.';
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        this.errorMessage = 'Error al cargar inventario general de stock.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setSubTab(tab: 'inventario' | 'produccion' | 'ventas'): void {
    this.activeSubTab = tab;
  }

  getBadgeClase(tipo: string): string {
    switch (tipo) {
      case 'MATERIA_PRIMA':
        return 'bg-amber-50 border border-amber-200 text-amber-800';
      case 'SEMI_ELABORADO':
        return 'bg-indigo-50 border border-indigo-200 text-indigo-800';
      case 'PLATO_FINAL':
        return 'bg-emerald-50 border border-emerald-200 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-805';
    }
  }
}

