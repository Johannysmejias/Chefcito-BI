import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Articulo, ArticuloService, VentaItem } from '../../services/articulo.service';

interface CartItem {
  plato: Articulo;
  cantidad: number;
  subtotal: number;
}

@Component({
  selector: 'app-punto-venta',
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

  // Seleccion actual
  selectedPlatoId: string = '';
  cantidadVenta = 1;

  constructor(private articuloService: ArticuloService) {}

  ngOnInit(): void {
    this.cargarPlatos();
  }

  cargarPlatos(): void {
    this.isLoading = true;
    this.articuloService.getPlatosFinales().subscribe({
      next: (data) => {
        this.platosDisponibles = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'No se pudieron cargar los platos a la venta.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  agregarAlCarrito(): void {
    const id = parseInt(this.selectedPlatoId, 10);
    if (isNaN(id) || this.cantidadVenta <= 0) {
      this.errorMessage = 'Debe seleccionar un plato y definir una cantidad valida.';
      return;
    }

    const plato = this.platosDisponibles.find(p => p.id === id);
    if (!plato) {
      this.errorMessage = 'El plato seleccionado no es valido.';
      return;
    }

    // Verificar si ya existe en el carrito
    const itemExistente = this.carrito.find(item => item.plato.id === id);
    const precio = plato.precio_venta || 0;

    if (itemExistente) {
      itemExistente.cantidad += this.cantidadVenta;
      itemExistente.subtotal = itemExistente.cantidad * precio;
    } else {
      this.carrito.push({
        plato,
        cantidad: this.cantidadVenta,
        subtotal: this.cantidadVenta * precio
      });
    }

    // Limpiar campos
    this.selectedPlatoId = '';
    this.cantidadVenta = 1;
    this.errorMessage = '';
    this.successMessage = '';
  }

  eliminarDelCarrito(index: number): void {
    this.carrito.splice(index, 1);
  }

  vaciarCarrito(): void {
    this.carrito = [];
    this.successMessage = '';
    this.errorMessage = '';
  }

  get totalVenta(): number {
    return this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
  }

  confirmarVenta(): void {
    if (this.carrito.length === 0) {
      this.errorMessage = 'El carrito de ventas se encuentra vacio.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Preparar el payload correcto estructurado en la API
    const req = {
      detalles: this.carrito.map(item => ({
        plato_id: item.plato.id,
        cantidad: item.cantidad
      }))
    };

    this.articuloService.registrarVenta(req).subscribe({
      next: (res) => {
        this.successMessage = `¡Venta procesada con éxito! ID de venta registrada: #${res.venta_id}. Total facturado: $${res.total_venta.toFixed(2)}`;
        this.carrito = []; // Vaciar carrito despues de la transaccion
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Error de stock insuficiente o transaccion fallida al procesar la venta.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }
}
