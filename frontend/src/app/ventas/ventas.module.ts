import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { PuntoVentaComponent } from './punto-venta.component';
import { VentasService } from './ventas.service';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    PuntoVentaComponent
  ],
  providers: [
    VentasService
  ],
  exports: [
    PuntoVentaComponent
  ]
})
export class VentasModule { }
