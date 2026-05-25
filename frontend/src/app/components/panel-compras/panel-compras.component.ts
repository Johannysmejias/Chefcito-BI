import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // <-- 1. Sumamos ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Articulo, ArticuloService } from '../../services/articulo.service';

@Component({
  selector: 'app-panel-compras',
  templateUrl: './panel-compras.component.html',
  styleUrls: ['./panel-compras.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class PanelComprasComponent implements OnInit {
  materiasPrimas: Articulo[] = [];
  isLoading = false;
  errorMessage = '';

  mostrarModal = false;
  insumoSeleccionadoId: number | null = null;
  cantidadComprada: number | null = null;
  isSaving = false;

  // 2. Lo inyectamos en el constructor
  constructor(
    private articuloService: ArticuloService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarMateriasPrimas();
  }

  cargarMateriasPrimas(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.articuloService.getMateriasPrimas().subscribe({
      next: (data) => {
        this.materiasPrimas = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = 'No se pudieron cargar las materias primas.';
        this.isLoading = false;
        this.cdr.detectChanges();
        console.error(err);
      }
    });
  }

  // Abre el modal y limpia los campos del formulario
  abrirModalCompra(): void {
    this.insumoSeleccionadoId = null;
    this.cantidadComprada = null;
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  // Cierra el formulario
  cerrarModalCompra(): void {
    this.mostrarModal = false;
    this.cdr.detectChanges();
  }

  // Envía la compra al backend en Python
  guardarCompra(): void {
    if (!this.insumoSeleccionadoId || !this.cantidadComprada || this.cantidadComprada <= 0) {
      alert('Por favor, seleccione un insumo y coloque una cantidad válida.');
      return;
    }

    this.isSaving = true;
    this.articuloService.registrarCompraInsumo(this.insumoSeleccionadoId, this.cantidadComprada).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.mostrarModal = false; // Cerramos el formulario
        this.cargarMateriasPrimas(); // Recargamos la lista para ver el nuevo stock con 1 solo clic
        alert(res.message || 'Compra registrada exitosamente.');
      },
      error: (err) => {
        this.isSaving = false;
        this.cdr.detectChanges();
        alert('Error al registrar la compra en el servidor.');
        console.error(err);
      }
    });
  }

  isBajoMinimo(articulo: Articulo): boolean {
    return articulo.stock_actual < articulo.stock_minimo;
  }
}
