import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Articulo, ArticuloService } from '../../services/articulo.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-produccion-cocina',
  templateUrl: './produccion-cocina.component.html',
  styleUrls: ['./produccion-cocina.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ProduccionCocinaComponent implements OnInit {
  articulosBajos: Articulo[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Control de Modal
  showModal = false;
  selectedArticulo: Articulo | null = null;
  cantidadAProducir = 1;

  constructor(private articuloService: ArticuloService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargarPendientesCocina();
  }

  cargarPendientesCocina(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.articuloService.getArticulosCocina().subscribe({
      next: (data) => {
        this.articulosBajos = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = 'No se pudieron cargar los pendientes de cocina.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  abrirModalProduccion(articulo: Articulo): void {
    this.selectedArticulo = articulo;
    this.cantidadAProducir = 1; // Valor predeterminado
    this.showModal = true;
    this.successMessage = '';
    this.errorMessage = '';
  }

  cerrarModal(): void {
    this.showModal = false;
    this.selectedArticulo = null;
  }

  confirmarProduccion(): void {
    if (!this.selectedArticulo || this.cantidadAProducir <= 0) {
      this.errorMessage = 'Debe ingresar una cantidad valida mayor a 0.';
      return;
    }

    this.isLoading = true;
    const req = {
      semi_id: this.selectedArticulo.id,
      cantidad: this.cantidadAProducir
    };

    this.articuloService.registrarProduccion(req).subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.cerrarModal();
        // Volver a cargar la lista de cocina desde el servidor
        this.cargarPendientesCocina();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Error al registrar la produccion.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }
}
