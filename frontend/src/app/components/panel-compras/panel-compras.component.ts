import { Component, OnInit } from '@angular/core';
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

  constructor(private articuloService: ArticuloService) {}

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
      },
      error: (err) => {
        this.errorMessage = 'No se pudieron cargar las materias primas.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  isBajoMinimo(articulo: Articulo): boolean {
    return articulo.stock_actual < articulo.stock_minimo;
  }
}
