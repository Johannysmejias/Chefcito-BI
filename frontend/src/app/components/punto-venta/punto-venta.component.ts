import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Articulo, ArticuloService } from '../../services/articulo.service';
import { MesaService, Cuenta, MesaParaPedido } from '../../services/mesa.service';

interface CartItem {
  plato: Articulo;
  cantidad: number;
  subtotal: number;
}

type ModoPedido = 'mesa' | 'take_away' | 'delivery' | null;

@Component({
  selector: 'app-punto-venta',
  templateUrl: './punto-venta.component.html',
  styleUrls: ['./punto-venta.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class PuntoVentaComponent implements OnInit {
  platosDisponibles: Articulo[] = [];

  modo: ModoPedido = null;
  mesaSeleccionada: MesaParaPedido | null = null;
  cuentaActual: Cuenta | null = null;

  carrito: CartItem[] = [];
  isLoading = false;
  isLoadingMesa = false;
  successMessage = '';
  errorMessage = '';

  // Seleccion actual
  selectedPlatoId: string = '';
  cantidadVenta = 1;

  constructor(
    private articuloService: ArticuloService,
    private mesaService: MesaService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarPlatos();

    // Si venimos de un click en el Plano de Mesas, ya hay una mesa pendiente esperando.
    const mesaPendiente = this.mesaService.consumirMesaPendiente();
    if (mesaPendiente) {
      this.seleccionarMesa(mesaPendiente);
    }
  }

  cargarPlatos(): void {
    this.articuloService.getPlatosFinales().subscribe({
      next: (data) => {
        this.platosDisponibles = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = 'No se pudieron cargar los platos a la venta.';
        console.error(err);
      }
    });
  }

  // =======================================================
  // SELECCION DE MODO (mesa / take away / delivery)
  // =======================================================

  seleccionarMesa(mesa: MesaParaPedido): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isLoadingMesa = true;
    this.modo = 'mesa';
    this.mesaSeleccionada = mesa;
    this.carrito = [];

    this.mesaService.abrirCuenta(mesa.id_mesa).subscribe({
      next: (cuenta) => {
        this.cuentaActual = cuenta;
        this.isLoadingMesa = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'No se pudo abrir la cuenta de la mesa.';
        this.isLoadingMesa = false;
        this.modo = null;
        this.mesaSeleccionada = null;
        this.cdr.detectChanges();
      }
    });
  }

  elegirModo(modo: 'take_away' | 'delivery'): void {
    this.modo = modo;
    this.mesaSeleccionada = null;
    this.cuentaActual = null;
    this.carrito = [];
    this.errorMessage = '';
    this.successMessage = '';
  }

  volverAlInicio(): void {
    this.modo = null;
    this.mesaSeleccionada = null;
    this.cuentaActual = null;
    this.carrito = [];
    this.errorMessage = '';
    this.successMessage = '';
  }

  // =======================================================
  // CARRITO (comun a los 3 modos)
  // =======================================================

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

  get totalCarrito(): number {
    return this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
  }

  get totalCuenta(): number {
    return (this.cuentaActual?.total || 0) + this.totalCarrito;
  }

  // =======================================================
  // MODO MESA: cuenta abierta (rondas + cobro final)
  // =======================================================

  enviarPedido(): void {
    if (!this.cuentaActual || this.carrito.length === 0) {
      this.errorMessage = 'Agregá al menos un plato antes de enviar el pedido.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const detalles = this.carrito.map(item => ({
      plato_id: item.plato.id,
      cantidad: item.cantidad
    }));

    this.mesaService.agregarItemsCuenta(this.cuentaActual.venta_id, detalles).subscribe({
      next: (cuenta) => {
        this.cuentaActual = cuenta;
        this.carrito = [];
        this.successMessage = 'Pedido enviado a cocina correctamente.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Error de stock insuficiente o transaccion fallida al enviar el pedido.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cobrarCuenta(): void {
    if (!this.cuentaActual) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const etiquetaMesa = this.mesaSeleccionada?.etiqueta_visible;

    this.mesaService.cerrarCuenta(this.cuentaActual.venta_id).subscribe({
      next: (cuenta) => {
        this.successMessage = `¡Mesa ${etiquetaMesa} cobrada! Total: $${cuenta.total.toFixed(2)}`;
        this.isLoading = false;
        this.volverAlInicio();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'No se pudo cobrar la cuenta.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // =======================================================
  // MODO TAKE AWAY / DELIVERY: venta directa, sin mesa
  // =======================================================

  confirmarVentaDirecta(): void {
    if (this.carrito.length === 0 || (this.modo !== 'take_away' && this.modo !== 'delivery')) {
      this.errorMessage = 'El pedido se encuentra vacio.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const modalidad: 'take_away' | 'delivery' = this.modo;
    const req = {
      detalles: this.carrito.map(item => ({
        plato_id: item.plato.id,
        cantidad: item.cantidad
      })),
      modalidad
    };

    this.articuloService.registrarVenta(req).subscribe({
      next: (res) => {
        this.successMessage = `¡Venta procesada con éxito! ID de venta registrada: #${res.venta_id}. Total facturado: $${res.total_venta.toFixed(2)}`;
        this.carrito = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Error de stock insuficiente o transaccion fallida al procesar la venta.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
