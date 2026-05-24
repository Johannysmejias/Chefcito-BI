import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VentasService, Articulo, VentaRequest } from './ventas.service';

interface CartItem {
  plato: Articulo;
  cantidad: number;
  subtotal: number;
}

@Component({
  selector: 'app-punto-venta-nuevo',
  templateUrl: './punto-venta.component.html',
  styleUrls: ['./punto-venta.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class PuntoVentaComponent implements OnInit {
  platosDisponibles: Articulo[] = [];
  carrito: CartItem[] = [];
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  // Búsqueda y Selección
  searchTerm: string = '';
  selectedPlatoId: string = '';
  cantidadVenta = 1;

  constructor(private ventasService: VentasService) {}

  ngOnInit(): void {
    this.cargarPlatos();
  }

  /**
   * Carga los platos finales disponibles desde el FastAPI Backend
   */
  cargarPlatos(): void {
    this.isLoading = true;
    this.ventasService.getPlatosFinales().subscribe({
      next: (data) => {
        this.platosDisponibles = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'No se pudieron recuperar las ofertas de PLATO_FINAL desde el servidor.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  /**
   * Retorna los platos que coinciden con el término de búsqueda
   */
  get platosFiltrados(): Articulo[] {
    if (!this.searchTerm.trim()) {
      return this.platosDisponibles;
    }
    const term = this.searchTerm.toLowerCase();
    return this.platosDisponibles.filter(p => 
      p.nombre.toLowerCase().includes(term) || p.id.toString().includes(term)
    );
  }

  /**
   * Añade el plato seleccionado y la cantidad especificada al carrito local
   */
  agregarAlCarrito(): void {
    const id = parseInt(this.selectedPlatoId, 10);
    if (isNaN(id) || this.cantidadVenta <= 0) {
      this.errorMessage = 'Por favor seleccione un plato final de la lista e ingrese una cantidad aprobada.';
      return;
    }

    const plato = this.platosDisponibles.find(p => p.id === id);
    if (!plato) {
      this.errorMessage = 'El artículo seleccionado no corresponde a un plato final válido.';
      return;
    }

    const precio = plato.precio_venta || 0;
    const existente = this.carrito.find(item => item.plato.id === id);

    if (existente) {
      existente.cantidad += this.cantidadVenta;
      existente.subtotal = existente.cantidad * precio;
    } else {
      this.carrito.push({
        plato,
        cantidad: this.cantidadVenta,
        subtotal: this.cantidadVenta * precio
      });
    }

    // Resetear formulario de selección
    this.selectedPlatoId = '';
    this.cantidadVenta = 1;
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Elimina un item específico del carrito
   */
  eliminarDelCarrito(index: number): void {
    this.carrito.splice(index, 1);
  }

  /**
   * Vacía la orden en curso
   */
  vaciarCarrito(): void {
    this.carrito = [];
    this.successMessage = '';
    this.errorMessage = '';
  }

  /**
   * Obtiene la facturación acumulada total
   */
  get totalFacturado(): number {
    return this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
  }

  /**
   * Dispara el registro de la venta en lote al Stored Procedure MySQL
   */
  confirmarVenta(): void {
    if (this.carrito.length === 0) {
      this.errorMessage = 'No puede procesar una venta si el carrito de compras está vacío.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload: VentaRequest = {
      detalles: this.carrito.map(item => ({
        plato_id: item.plato.id,
        cantidad: item.cantidad
      }))
    };

    this.ventasService.registrarVenta(payload).subscribe({
      next: (res) => {
        this.successMessage = `¡Venta registrada con éxito bajo ID #${res.venta_id}! Costo total: $${res.total_venta.toFixed(2)}. Insumos descontados de la base de datos de manera atómica (BOM).`;
        this.carrito = []; // Vaciar el carrito tras el checkout exitoso
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'No se pudo culminar la venta por falta de stock preventivo (MySQL Transaccional).';
        this.isLoading = false;
        console.error(err);
      }
    });
  }
}
