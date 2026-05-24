import React, { useState, useEffect } from 'react';
import { 
  ChefHat, 
  ShoppingCart, 
  DollarSign, 
  Layers, 
  Code, 
  AlertTriangle, 
  CheckCircle, 
  RotateCcw, 
  FileText, 
  Copy, 
  Package, 
  Server, 
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  CircleCheck,
  X,
  Plus
} from 'lucide-react';

// =======================================================
// Declaracion de Tipos Core & Interfaces (BOM Schema)
// =======================================================
interface Articulo {
  id: number;
  nombre: string;
  tipo: 'MATERIA_PRIMA' | 'SEMI_ELABORADO' | 'PLATO_FINAL';
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  precio_venta: number | null;
}

interface Receta {
  producto_id: number;
  ingrediente_id: number;
  cantidad: number;
}

interface ProduccionLogReg {
  id: number;
  semi_id: number;
  semi_nombre: string;
  cantidad: number;
  fecha: string;
}

interface VentaLogReg {
  id: number;
  venta_id: number;
  plato_id: number;
  plato_nombre: string;
  cantidad: number;
  fecha: string;
  subtotal: number;
}

interface VentaCabecera {
  id: number;
  fecha: string;
  total: number;
}

// =======================================================
// Base de Datos Estática de Referencia (Catalogo Inicial)
// =======================================================
const ARTICULOS_INICIALES: Articulo[] = [
  // MATERIA_PRIMA (Raw Materials)
  { id: 1, nombre: "Harina de Trigo 0000", tipo: "MATERIA_PRIMA", unidad_medida: "kg", stock_actual: 4.500, stock_minimo: 10.000, precio_venta: null },
  { id: 2, nombre: "Levadura Deshidratada", tipo: "MATERIA_PRIMA", unidad_medida: "grs", stock_actual: 120.000, stock_minimo: 300.000, precio_venta: null },
  { id: 3, nombre: "Queso Muzzarella Hilado", tipo: "MATERIA_PRIMA", unidad_medida: "kg", stock_actual: 12.000, stock_minimo: 5.000, precio_venta: null },
  { id: 4, nombre: "Salsa de Tomate Puré", tipo: "MATERIA_PRIMA", unidad_medida: "kg", stock_actual: 3.200, stock_minimo: 6.000, precio_venta: null },
  { id: 5, nombre: "Jamón Cocido Feteado", tipo: "MATERIA_PRIMA", unidad_medida: "kg", stock_actual: 1.200, stock_minimo: 2.500, precio_venta: null },
  { id: 6, nombre: "Aceitunas Verdes Descarozadas", tipo: "MATERIA_PRIMA", unidad_medida: "unidades", stock_actual: 80, stock_minimo: 150, precio_venta: null },
  
  // SEMI_ELABORADO (Internal Cooked Kitchen Items)
  { id: 7, nombre: "Prepizza Muzzarella Base", tipo: "SEMI_ELABORADO", unidad_medida: "unidades", stock_actual: 2, stock_minimo: 10, precio_venta: null },
  { id: 8, nombre: "Salsa Especial Preparada", tipo: "SEMI_ELABORADO", unidad_medida: "porciones", stock_actual: 1, stock_minimo: 5, precio_venta: null },
  { id: 9, nombre: "Masa de Prepizza Simple", tipo: "SEMI_ELABORADO", unidad_medida: "unidades", stock_actual: 12, stock_minimo: 5, precio_venta: null },

  // PLATO_FINAL (Final Commercial Dish sold to customers)
  { id: 10, nombre: "Pizza de Muzzarella Grande", tipo: "PLATO_FINAL", unidad_medida: "unidades", stock_actual: 5, stock_minimo: 0, precio_venta: 12.00 },
  { id: 11, nombre: "Pizza Especial de Jamón", tipo: "PLATO_FINAL", unidad_medida: "unidades", stock_actual: 3, stock_minimo: 0, precio_venta: 15.50 },
  { id: 12, nombre: "Fainá Crujiente Porción", tipo: "PLATO_FINAL", unidad_medida: "unidades", stock_actual: 20, stock_minimo: 4, precio_venta: 3.00 }
];

// Recetas (BOM - Relaciones de componentes de fabricación)
const RECETAS_BOM: Receta[] = [
  // Prepizza Muzzarella Base (id 7) se hace con:
  { producto_id: 7, ingrediente_id: 1, cantidad: 0.200 }, // 200g Harina
  { producto_id: 7, ingrediente_id: 2, cantidad: 10.00 }, // 10g Levadura
  { producto_id: 7, ingrediente_id: 4, cantidad: 0.150 }, // 150g Salsa de tomate

  // Salsa Especial Preparada (id 8) se hace con:
  { producto_id: 8, ingrediente_id: 4, cantidad: 0.250 }, // 250g De Salsa Base
  { producto_id: 8, ingrediente_id: 6, cantidad: 4.000 }, // 4 Aceitunas

  // Masa de Prepizza Simple (id 9) se hace con:
  { producto_id: 9, ingrediente_id: 1, cantidad: 0.250 }, // 250g Harina
  { producto_id: 9, ingrediente_id: 2, cantidad: 5.000 },  // 5g Levadura

  // Pizza de Muzzarella Grande (id 10) se despacha con:
  { producto_id: 10, ingrediente_id: 7, cantidad: 1.000 }, // 1 Prepizza Base
  { producto_id: 10, ingrediente_id: 3, cantidad: 0.400 }, // 400g Queso muzzarella

  // Pizza Especial de Jamón (id 11) se despacha con:
  { producto_id: 11, ingrediente_id: 7, cantidad: 1.000 }, // 1 Prepizza
  { producto_id: 11, ingrediente_id: 3, cantidad: 0.300 }, // 300g Muzzarella
  { producto_id: 11, ingrediente_id: 5, cantidad: 0.200 }, // 200g Jamon

  // Faina Crujiente Porción (id 12) se hace directamente con:
  { producto_id: 12, ingrediente_id: 1, cantidad: 0.050 }  // 50g harina
];

export default function App() {
  // --- Estados de Datos de la Aplicación ---
  const [articulos, setArticulos] = useState<Articulo[]>(() => {
    const saved = localStorage.getItem('pizza_articulos');
    return saved ? JSON.parse(saved) : ARTICULOS_INICIALES;
  });

  const [historialProduccion, setHistorialProduccion] = useState<ProduccionLogReg[]>(() => {
    const saved = localStorage.getItem('pizza_historial_prod');
    return saved ? JSON.parse(saved) : [
      { id: 1, semi_id: 7, semi_nombre: "Prepizza Muzzarella Base", cantidad: 5, fecha: "2026-05-23T18:40:00.000Z" },
      { id: 2, semi_id: 9, semi_nombre: "Masa de Prepizza Simple", cantidad: 10, fecha: "2026-05-23T19:15:00.000Z" }
    ];
  });

  const [historialVentas, setHistorialVentas] = useState<VentaLogReg[]>(() => {
    const saved = localStorage.getItem('pizza_historial_ventas');
    return saved ? JSON.parse(saved) : [
      { id: 1, venta_id: 101, plato_id: 10, plato_nombre: "Pizza de Muzzarella Grande", cantidad: 2, fecha: "2026-05-23T20:20:00.000Z", subtotal: 24.00 },
      { id: 2, venta_id: 101, plato_id: 12, plato_nombre: "Fainá Crujiente Porción", cantidad: 4, fecha: "2026-05-23T20:20:00.000Z", subtotal: 12.00 }
    ];
  });

  const [ventasHeader, setVentasHeader] = useState<VentaCabecera[]>(() => {
    const saved = localStorage.getItem('pizza_ventas_headers');
    return saved ? JSON.parse(saved) : [
      { id: 101, fecha: "2026-05-23T20:20:00.000Z", total: 36.00 }
    ];
  });

  // Guardar en LocalStorage cada vez que cambian los datos
  useEffect(() => {
    localStorage.setItem('pizza_articulos', JSON.stringify(articulos));
  }, [articulos]);

  useEffect(() => {
    localStorage.setItem('pizza_historial_prod', JSON.stringify(historialProduccion));
  }, [historialProduccion]);

  useEffect(() => {
    localStorage.setItem('pizza_historial_ventas', JSON.stringify(historialVentas));
  }, [historialVentas]);

  useEffect(() => {
    localStorage.setItem('pizza_ventas_headers', JSON.stringify(ventasHeader));
  }, [ventasHeader]);

  // --- Estados de Navegacion Principal ---
  const [activeTab, setActiveTab ] = useState<'cocina' | 'compras' | 'punto_venta' | 'dashboard' | 'codigo'>('cocina');

  // --- Estados de Interacción de Formularios ---
  // Cocina Modal State
  const [cocinaModalOpen, setCocinaModalOpen] = useState(false);
  const [selectedCocinaArt, setSelectedCocinaArt] = useState<Articulo | null>(null);
  const [cantidadProducir, setCantidadProducir] = useState<number>(1);
  const [cocinaSuccess, setCocinaSuccess] = useState<string | null>(null);
  const [cocinaError, setCocinaError] = useState<string | null>(null);

  // POS (Punto de Venta) State
  const [posSelectedPlatoId, setPosSelectedPlatoId] = useState<string>('');
  const [posCantidad, setPosCantidad] = useState<number>(1);
  const [posCart, setPosCart] = useState<{ plato: Articulo; cantidad: number; subtotal: number }[]>([]);
  const [posSuccess, setPosSuccess] = useState<string | null>(null);
  const [posError, setPosError] = useState<string | null>(null);

  // Insumos Compra / Reabastecimiento Rápido (Simulator helper)
  const [insumoSelectedId, setInsumoSelectedId] = useState<string>('');
  const [insumoCantidad, setInsumoCantidad] = useState<number>(5);

  // Selector de Códigos Entregables
  const [activeCodeTab, setActiveCodeTab] = useState<'fastapi' | 'service' | 'cocina_cmp' | 'compras_cmp' | 'pos_cmp' | 'dash_cmp'>('fastapi');
  const [copiedText, setCopiedText] = useState(false);

  // --- Resetear a Datos Iniciales ---
  const handleResetData = () => {
    if (window.confirm("¿Seguro que desea restaurar los datos iniciales de inventario y logs?")) {
      setArticulos(ARTICULOS_INICIALES);
      setHistorialProduccion([
        { id: 1, semi_id: 7, semi_nombre: "Prepizza Muzzarella Base", cantidad: 5, fecha: "2026-05-23T18:40:00.000Z" },
        { id: 2, semi_id: 9, semi_nombre: "Masa de Prepizza Simple", cantidad: 10, fecha: "2026-05-23T19:15:00.000Z" }
      ]);
      setHistorialVentas([
        { id: 1, venta_id: 101, plato_id: 10, plato_nombre: "Pizza de Muzzarella Grande", cantidad: 2, fecha: "2026-05-23T20:20:00.000Z", subtotal: 24.00 },
        { id: 2, venta_id: 101, plato_id: 12, plato_nombre: "Fainá Crujiente Porción", cantidad: 4, fecha: "2026-05-23T20:20:00.000Z", subtotal: 12.00 }
      ]);
      setVentasHeader([
        { id: 101, fecha: "2026-05-23T20:20:00.000Z", total: 36.00 }
      ]);
      setPosCart([]);
      setPosSuccess("Base de datos de demostración restaurada con éxito.");
      setPosError(null);
      setCocinaSuccess(null);
      setCocinaError(null);
    }
  };

  // =======================================================
  // LOGICA DEL SP `registrar_produccion`
  // =======================================================
  const ejecutarRegistrarProduccion = (semiId: number, cantidad: number) => {
    // 1. Obtener el artículo
    const articuloSemi = articulos.find(a => a.id === semiId);
    if (!articuloSemi) return { success: false, msg: "Artículo semi-elaborado no encontrado." };
    if (articuloSemi.tipo !== 'SEMI_ELABORADO') return { success: false, msg: "El artículo seleccionado no es un Semi-Elaborado." };

    // 2. Buscar ingredientes requeridos en base al BOM (receta)
    const ingredientesReceta = RECETAS_BOM.filter(r => r.producto_id === semiId);
    
    // Simular validación: ¿Tenemos suficiente inventario para fabricar y descontar?
    const nuevosArticulos = articulos.map(a => { return { ...a }; });

    // 3. Modificaciones en cascada (La transacción del SP)
    // 3.1 Sumamos stock del semi-elaborado
    const itemSemi = nuevosArticulos.find(a => a.id === semiId);
    if (itemSemi) {
      itemSemi.stock_actual = Number(itemSemi.stock_actual) + cantidad;
    }

    // 3.2 Descontamos del catálogo todos los ingredientes implicados en la receta (BOM)
    for (const ingrediente of ingredientesReceta) {
      const insumo = nuevosArticulos.find(a => a.id === ingrediente.ingrediente_id);
      if (insumo) {
        insumo.stock_actual = Number(insumo.stock_actual) - (ingrediente.cantidad * cantidad);
      }
    }

    // 4. Escribir registro en produccion_log
    const nuevoLogId = historialProduccion.length > 0 ? Math.max(...historialProduccion.map(l => l.id)) + 1 : 1;
    const nuevoLog: ProduccionLogReg = {
      id: nuevoLogId,
      semi_id: semiId,
      semi_nombre: articuloSemi.nombre,
      cantidad: cantidad,
      fecha: new Date().toISOString()
    };

    setArticulos(nuevosArticulos);
    setHistorialProduccion([nuevoLog, ...historialProduccion]);

    const stockFinal = itemSemi ? itemSemi.stock_actual : 0;
    const stockMin = itemSemi ? itemSemi.stock_minimo : 0;

    return { 
      success: true, 
      msg: `Se produjeron ${cantidad} ${articuloSemi.unidad_medida} de ${articuloSemi.nombre}.`,
      sigueBajoMinimo: stockFinal < stockMin,
      stockFinal
    };
  };

  // =======================================================
  // LOGICA DEL SP `registrar_venta_detalle` (Carrito unificado)
  // =======================================================
  const ejecutarRegistrarVenta = (items: { plato: Articulo; cantidad: number }[]) => {
    if (items.length === 0) return { success: false, msg: "El pedido está vacío." };

    const nuevosArticulos = articulos.map(a => { return { ...a }; });
    let totalFacturado = 0;
    const nuevosDetalles: VentaLogReg[] = [];

    // Generar ID de Cabecera de Venta
    const nuevaVentaId = ventasHeader.length > 0 ? Math.max(...ventasHeader.map(v => v.id)) + 1 : 101;
    const nuevoLogIdBase = historialVentas.length > 0 ? Math.max(...historialVentas.map(h => h.id)) + 1 : 1;

    for (let i = 0; i < items.length; i++) {
      const { plato, cantidad } = items[i];
      const precioUnitario = plato.precio_venta || 0;
      const subtotal = precioUnitario * cantidad;
      totalFacturado += subtotal;

      // Descontar del artículo e ingredientes vía receta (BOM)
      const ingredientesDirectos = RECETAS_BOM.filter(r => r.producto_id === plato.id);

      for (const formula of ingredientesDirectos) {
        const insumo = nuevosArticulos.find(a => a.id === formula.ingrediente_id);
        if (insumo) {
          insumo.stock_actual = Number(insumo.stock_actual) - (formula.cantidad * cantidad);
        }
      }

      const platoOriginal = nuevosArticulos.find(a => a.id === plato.id);
      if (platoOriginal) {
        platoOriginal.stock_actual = Number(platoOriginal.stock_actual) - cantidad;
      }

      // Preparar detalle de log
      nuevosDetalles.push({
        id: nuevoLogIdBase + i,
        venta_id: nuevaVentaId,
        plato_id: plato.id,
        plato_nombre: plato.nombre,
        cantidad: cantidad,
        fecha: new Date().toISOString(),
        subtotal: subtotal
      });
    }

    // Guardar Cabecera de Venta
    const nuevaCabecera: VentaCabecera = {
      id: nuevaVentaId,
      fecha: new Date().toISOString(),
      total: totalFacturado
    };

    setArticulos(nuevosArticulos);
    setVentasHeader([nuevaCabecera, ...ventasHeader]);
    setHistorialVentas([...nuevosDetalles, ...historialVentas]);

    return {
      success: true,
      venta_id: nuevaVentaId,
      total: totalFacturado,
      msg: `Venta #${nuevaVentaId} registrada por un total de $${totalFacturado.toFixed(2)}.`
    };
  };

  // Simular Reabastecimiento de Materia Prima (User helpful helper)
  const handleSimularCompra = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(insumoSelectedId, 10);
    if (isNaN(id) || insumoCantidad <= 0) return;

    const nuevosArticulos = articulos.map(a => {
      if (a.id === id) {
        return { ...a, stock_actual: Number(a.stock_actual) + insumoCantidad };
      }
      return a;
    });

    const insumoItem = articulos.find(a => a.id === id);
    setArticulos(nuevosArticulos);
    setPosSuccess(`Se compraron y adicionaron +${insumoCantidad} ${insumoItem?.unidad_medida} a ${insumoItem?.nombre}.`);
    setInsumoSelectedId('');
    setInsumoCantidad(5);
  };

  // --- Handlers de Interacción ---
  const handleOpenProduccionModal = (art: Articulo) => {
    setSelectedCocinaArt(art);
    setCantidadProducir(5); // Valor recomendado
    setCocinaSuccess(null);
    setCocinaError(null);
    setCocinaModalOpen(true);
  };

  const handleConfirmarProduccion = () => {
    if (!selectedCocinaArt || cantidadProducir <= 0) {
      setCocinaError("Debe ingresar una cantidad mayor a cero.");
      return;
    }

    const res = ejecutarRegistrarProduccion(selectedCocinaArt.id, cantidadProducir);
    
    if (res.success) {
      if (res.sigueBajoMinimo) {
        setCocinaSuccess(`Producción registrada. ¡Atención! El stock actual de ${selectedCocinaArt.nombre} es ahora ${res.stockFinal} ${selectedCocinaArt.unidad_medida}, aún por debajo de su stock mínimo de ${selectedCocinaArt.stock_minimo}. Permanecerá habilitado en el To-Do de cocina.`);
      } else {
        setCocinaSuccess(`Producción registrada con éxito. ${selectedCocinaArt.nombre} alcanzó stock de ${res.stockFinal} y ya cuenta con el mínimo normativo.`);
      }
      setCocinaModalOpen(false);
      setSelectedCocinaArt(null);
    } else {
      setCocinaError(res.msg);
    }
  };

  // POS Add to Order Cart
  const handlePosAddToCart = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(posSelectedPlatoId, 10);
    if (isNaN(id) || posCantidad <= 0) {
      setPosError("Debe seleccionar un artículo y definir una cantidad válida.");
      return;
    }

    const plato = articulos.find(a => a.id === id);
    if (!plato) return;

    const precio = plato.precio_venta || 0;
    const existente = posCart.find(item => item.plato.id === id);

    if (existente) {
      const nuevaCant = existente.cantidad + posCantidad;
      setPosCart(posCart.map(item => 
        item.plato.id === id 
          ? { ...item, cantidad: nuevaCant, subtotal: nuevaCant * precio } 
          : item
      ));
    } else {
      setPosCart([...posCart, {
        plato,
        cantidad: posCantidad,
        subtotal: posCantidad * precio
      }]);
    }

    setPosSelectedPlatoId('');
    setPosCantidad(1);
    setPosError(null);
    setPosSuccess(null);
  };

  const handlePosRemoveFromCart = (index: number) => {
    setPosCart(posCart.filter((_, idx) => idx !== index));
  };

  const handlePosCheckout = () => {
    if (posCart.length === 0) {
      setPosError("El pedido está vacío.");
      return;
    }

    const res = ejecutarRegistrarVenta(posCart);
    if (res.success) {
      setPosSuccess(res.msg);
      setPosCart([]);
      setPosError(null);
    } else {
      setPosError(res.msg || "Error al emitir la orden.");
    }
  };

  // Filtrara articulos para vistas específicas de demostración
  const cocinaPendientes = articulos.filter(a => a.tipo === 'SEMI_ELABORADO' && a.stock_actual < a.stock_minimo);
  const materiasPrimas = articulos.filter(a => a.tipo === 'MATERIA_PRIMA');
  const platosFinales = articulos.filter(a => a.tipo === 'PLATO_FINAL');

  // --- Manejo del Copiado de Código en Entregables ---
  const handleCopyCode = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="flex h-screen w-screen bg-stone-100 font-sans text-stone-900 overflow-hidden">
      
      {/* =======================================================
          SIDEBAR - "VIBRANT PALETTE" THEME DESIGN
          ======================================================= */}
      <aside className="w-64 bg-stone-100 border-r border-stone-200 flex flex-col shadow-lg shrink-0 select-none z-10">
        <div className="p-6 flex items-center gap-3 border-b border-stone-200">
          <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white shadow-md">
            <ChefHat className="w-6 h-6" />
          </div>
          <span className="text-red-600 font-black text-xl tracking-tight italic">PIZZERIA BOM</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto no-scrollbar">
          <button
            onClick={() => { setActiveTab('cocina'); setPosSuccess(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all text-left cursor-pointer ${
              activeTab === 'cocina' 
                ? 'bg-red-600 text-white shadow-lg shadow-red-200/50' 
                : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
            }`}
          >
            <ChefHat className="w-5 h-5 shrink-0" />
            <span className="text-xs uppercase tracking-wider">Kitchen To-Do</span>
            {cocinaPendientes.length > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full leading-none shadow-sm">
                {cocinaPendientes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('compras'); setPosSuccess(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all text-left cursor-pointer ${
              activeTab === 'compras' 
                ? 'bg-red-600 text-white shadow-lg shadow-red-200/50' 
                : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
            }`}
          >
            <ShoppingCart className="w-5 h-5 shrink-0" />
            <span className="text-xs uppercase tracking-wider">Compras BOM</span>
            {materiasPrimas.filter(m => m.stock_actual < m.stock_minimo).length > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none animate-pulse">
                ALERTA
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('punto_venta'); setPosSuccess(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all text-left cursor-pointer ${
              activeTab === 'punto_venta' 
                ? 'bg-red-600 text-white shadow-lg shadow-red-200/50' 
                : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
            }`}
          >
            <DollarSign className="w-5 h-5 shrink-0" />
            <span className="text-xs uppercase tracking-wider">POS Ventas</span>
          </button>

          <button
            onClick={() => { setActiveTab('dashboard'); setPosSuccess(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all text-left cursor-pointer ${
              activeTab === 'dashboard' 
                ? 'bg-red-600 text-white shadow-lg shadow-red-200/50' 
                : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
            }`}
          >
            <Layers className="w-5 h-5 shrink-0" />
            <span className="text-xs uppercase tracking-wider">Dashboard</span>
          </button>

          <button
            onClick={() => { setActiveTab('codigo'); setPosSuccess(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-left transition-all border border-dashed ${
              activeTab === 'codigo' 
                ? 'bg-stone-900 text-emerald-400 border-transparent shadow-lg' 
                : 'text-stone-600 border-stone-300 hover:bg-stone-200/60 hover:text-stone-900'
            }`}
          >
            <Code className="w-5 h-5 shrink-0" />
            <span className="text-xs uppercase tracking-wider">Documentos API</span>
          </button>
        </nav>

        <div className="p-6 bg-stone-200/40 mt-auto shrink-0 border-t border-stone-200">
          <div className="text-stone-500 text-[10px] uppercase tracking-wider font-extrabold font-sans">Entorno MySQL</div>
          <div className="text-stone-800 font-mono text-[10px] mt-1 flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            <span>Online (InnoDB)</span>
          </div>
        </div>
      </aside>

      {/* =======================================================
          MAIN BODY AREA - "VIBRANT PALETTE" THEME DESIGN
          ======================================================= */}
      <main className="flex-1 flex flex-col overflow-hidden bg-stone-50">
        
        {/* TOP COMPONENT APP BAR */}
        <header className="h-16 bg-white border-b border-stone-200 px-8 flex items-center justify-between shadow-sm shrink-0 select-none">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-stone-800 tracking-wider uppercase font-sans">
              {activeTab === 'cocina' && "To-Do Cocina • Producción de Ingredientes"}
              {activeTab === 'compras' && "Stock de Materia Prima & Reabastecimiento"}
              {activeTab === 'punto_venta' && "Terminal Punto de Venta (POS)"}
              {activeTab === 'dashboard' && "Panel de Gestión Integral & Kárdex MySQL"}
              {activeTab === 'codigo' && "Módulos de Código Fuente Solicitados"}
            </h2>
          </div>
          
          <div className="flex gap-4 items-center">
            <button
              onClick={handleResetData}
              className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-black rounded-full border border-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Restaurar base de datos a valores por defecto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Resetear Demo
            </button>
            <div className="px-3 py-1 bg-red-50 text-red-600 border border-red-100 rounded-full text-[10px] font-black uppercase tracking-wider">
              {articulos.filter(a => a.stock_actual < a.stock_minimo).length} ALERTAS
            </div>
          </div>
        </header>

        {/* CONTAINER ROUTED PAGE VIEW */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {/* SUCCESS ALERTS PLATFORM WIDE */}
          {posSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-3xl flex items-center justify-between shadow-lg animate-in fade-in duration-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="text-emerald-600 shrink-0 w-5 h-5" />
                <p className="text-xs font-bold">{posSuccess}</p>
              </div>
              <button onClick={() => setPosSuccess(null)} className="text-emerald-500 hover:text-emerald-700 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ===============================================================
              VIEW 1: KITCHEN TO-DO LIST (SEMI_ELABORADOS Under Stock Mínimo)
              =============================================================== */}
          {activeTab === 'cocina' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xl space-y-1">
                <h2 className="text-lg font-black text-stone-800 uppercase tracking-tight flex items-center gap-2">
                  👩‍🍳 Lista de Abastecimiento de Cocina
                </h2>
                <p className="text-stone-500 text-xs">
                  Artículos de tipo <strong>SEMI_ELABORADO</strong> cuyo stock actual es inferior al stock mínimo preventivo. Presione "Marcar como hecho" e ingrese lo producido para correr el descuento de materiales.
                </p>
              </div>

              {cocinaSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-start gap-2.5 shadow-md">
                  <CheckCircle className="text-emerald-600 shrink-0 w-5 h-5 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="font-bold">{cocinaSuccess}</p>
                  </div>
                  <button onClick={() => setCocinaSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {cocinaPendientes.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-14 text-center flex flex-col items-center justify-center space-y-3 shadow-md">
                  <div className="bg-white p-4 rounded-full text-3xl shadow-inner">🧑‍🍳</div>
                  <h3 className="text-md font-bold text-emerald-900">Todo en Orden</h3>
                  <p className="text-xs text-emerald-700 max-w-md">
                    No hay artículos semi-elaborados que soliciten atención inmediata. Todos los caldos, bases y masas se encuentran en niveles seguros de almacenamiento.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cocinaPendientes.map(art => {
                    const dif = Math.max(0, art.stock_minimo - art.stock_actual);
                    return (
                      <div 
                        key={art.id} 
                        className="bg-white rounded-3xl border border-stone-200 shadow-xl p-5 flex flex-col justify-between gap-4 relative hover:shadow-2xl transition-all"
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">COD #{art.id} • SEMI_ELABORADO</span>
                              <h3 className="text-base font-black text-stone-800 leading-tight mt-0.5">{art.nombre}</h3>
                            </div>
                            <span className="text-lg bg-red-100 p-2 rounded-xl text-red-600 leading-none font-bold">⚠️</span>
                          </div>

                          <div className="bg-stone-50 rounded-2xl p-4 space-y-2.5 border border-stone-100">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-stone-500 font-bold">Stock Disponible:</span>
                              <span className="font-bold text-stone-800">{art.stock_actual} {art.unidad_medida}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-stone-500 font-bold">Límite Requerido:</span>
                              <span className="font-bold text-stone-800">{art.stock_minimo} {art.unidad_medida}</span>
                            </div>
                            
                            <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-red-500 h-full rounded-full transition-all" 
                                style={{ width: `${Math.min(100, (art.stock_actual / art.stock_minimo) * 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-3 bg-red-50 text-[11px] text-red-955 flex gap-2 rounded-2xl border border-red-100">
                            <span>🚨</span>
                            <div>
                              Se necesitan registrar <strong className="font-black">{dif.toFixed(1)} {art.unidad_medida}</strong> para apagar la alerta.
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenProduccionModal(art)}
                          className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md shadow-red-200"
                        >
                          📋 Marcar como hecho
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===============================================================
              VIEW 2: RAW MATERIALS TABLE (Compras / Insumos)
              =============================================================== */}
          {activeTab === 'compras' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xl">
                <h2 className="text-lg font-black text-stone-800 uppercase tracking-tight flex items-center gap-2">
                  🛒 Inventario de Materias Primas e Insumos
                </h2>
                <p className="text-stone-500 text-xs mt-1">
                  Listado global de los insumos crudos necesarios para preparar semi-elaborados. Aquellos insumos marcados en <strong>rojo</strong> han cruzado la barrera del stock mínimo legal de Pizza Tradición.
                </p>
              </div>

              {/* Simulador de compas */}
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xl space-y-4">
                <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                  ⚙️ Simulador de Compra de Mercadería / Recepción de Pedidos proveedores
                </h4>
                <form onSubmit={handleSimularCompra} className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Materia Prima Recibida</label>
                    <select
                      value={insumoSelectedId}
                      onChange={(e) => setInsumoSelectedId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-stone-200 bg-stone-50 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-red-500 outline-none text-stone-800 font-bold transition-all"
                      required
                    >
                      <option value="" disabled>-- Seleccione ingrediente --</option>
                      {materiasPrimas.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.nombre} (ID {m.id}) -- Stock: {m.stock_actual} / Min: {m.stock_minimo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-44">
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Cantidad Comprada</label>
                    <input
                      type="number"
                      value={insumoCantidad}
                      onChange={(e) => setInsumoCantidad(Math.max(1, parseFloat(e.target.value) || 0))}
                      className="w-full px-4 py-2 bg-stone-50 rounded-xl border border-stone-200 text-xs focus:bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-stone-800 transition-all text-center"
                      min="1"
                      step="any"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg shadow-red-200/50 cursor-pointer"
                  >
                    + Registrar Compra
                  </button>
                </form>
              </div>

              {/* Tabla de existencias con lógica visual requerida */}
              <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden">
                <div className="p-5 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
                  <h3 className="font-extrabold text-stone-700 uppercase text-xs tracking-wider">Planilla de Control de Materiales</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">ID</th>
                        <th className="px-6 py-4">Ingrediente Comprable</th>
                        <th className="px-6 py-4 text-right">Stock en Depósito</th>
                        <th className="px-6 py-4 text-right">Stock de Alerta Mínimo</th>
                        <th className="px-6 py-4">Unidad</th>
                        <th className="px-6 py-4 text-center">Estado del Material</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {materiasPrimas.map(mp => {
                        const bajoMin = mp.stock_actual < mp.stock_minimo;
                        return (
                          <tr 
                            key={mp.id}
                            className={`transition-colors duration-150 ${bajoMin ? 'bg-red-100/50 hover:bg-red-100 text-red-950 font-semibold shadow-inner' : 'hover:bg-stone-100/50 text-stone-700'}`}
                          >
                            <td className="px-6 py-4 font-mono font-bold text-stone-400">#{mp.id}</td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-stone-800 block text-sm">{mp.nombre}</span>
                              <span className="text-[9px] text-stone-400 uppercase tracking-widest font-mono">materia_prima</span>
                            </td>
                            <td className={`px-6 py-4 text-right font-black text-sm ${bajoMin ? 'text-red-700 font-black' : 'text-stone-800'}`}>
                              {mp.stock_actual.toFixed(1)}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-stone-500">
                              {mp.stock_minimo.toFixed(1)}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] bg-stone-100 text-stone-600 px-2.5 py-1 rounded-lg font-mono uppercase font-bold">
                                {mp.unidad_medida}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {bajoMin ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-200 text-red-850 rounded-full text-[9px] font-black uppercase tracking-wider border border-red-300">
                                  ⚠️ reponer material
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                  CONFIABLE
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              VIEW 3: POINT OF SALE (Módulo de Ventas)
              =============================================================== */}
          {activeTab === 'punto_venta' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xl">
                <h2 className="text-lg font-black text-stone-850 uppercase tracking-tight flex items-center gap-2">
                  🏪 Módulo Punto de Venta (POS)
                </h2>
                <p className="text-stone-500 text-xs mt-1">
                  Registre los consumos de los clientes en salón. Al presionar "Finalizar Venta", el sistema descontará todos los materiales primas e intermedios usando las explosiones BOM.
                </p>
              </div>

              {posError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex items-center gap-2.5 shadow-md">
                  <ShieldAlert className="text-red-600 shrink-0 w-5 h-5 animate-pulse" />
                  <p className="text-xs font-black uppercase tracking-wider">{posError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Selector */}
                <div className="lg:col-span-12 xl:col-span-5 bg-white border border-stone-200 rounded-3xl p-6 shadow-xl space-y-6">
                  <h3 className="text-xs font-black text-stone-700 pb-2 border-b border-stone-100 uppercase tracking-widest">
                    Adicionar Plato al Pedido
                  </h3>

                  <form onSubmit={handlePosAddToCart} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-505 uppercase tracking-wider mb-2">Artículos Listos a la Venta</label>
                      <select
                        value={posSelectedPlatoId}
                        onChange={(e) => setPosSelectedPlatoId(e.target.value)}
                        className="w-full p-3.5 rounded-xl border border-stone-200 bg-stone-50 text-xs focus:bg-white focus:ring-2 focus:ring-red-500 outline-none text-stone-800 font-bold transition-all cursor-pointer"
                      >
                        <option value="">-- Elige Plato --</option>
                        {platosFinales.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} - ${Number(p.precio_venta).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-505 uppercase tracking-wider mb-2">Porciones</label>
                      <div className="flex gap-3">
                        <input
                          type="number"
                          value={posCantidad}
                          onChange={(e) => setPosCantidad(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs focus:bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-stone-800 transition-all text-center"
                          min="1"
                        />
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="space-y-3 pt-4 border-t border-stone-150">
                    <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Catálogo e Receta BOM Asociado</h4>
                    <div className="bg-stone-50 rounded-2xl p-4 divide-y divide-stone-150 max-h-56 overflow-y-auto border border-stone-100">
                      {platosFinales.map(p => {
                        const formulas = RECETAS_BOM.filter(f => f.producto_id === p.id);
                        return (
                          <div key={p.id} className="py-2 text-xs flex justify-between items-start gap-4">
                            <div>
                              <span className="font-bold text-stone-800 block">{p.nombre}</span>
                              <div className="text-[9.5px] text-stone-400 mt-0.5">
                                Receta: {formulas.map(f => {
                                  const insumo = articulos.find(a => a.id === f.ingrediente_id);
                                  return `${f.cantidad} ${insumo?.unidad_medida} de ${insumo?.nombre}`;
                                }).join(', ')}
                              </div>
                            </div>
                            <span className="font-black text-red-600 font-mono">${Number(p.precio_venta).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Comprobante de Venta */}
                <div className="lg:col-span-12 xl:col-span-7 bg-red-50 border border-red-100 rounded-3xl p-6 shadow-xl flex flex-col justify-between min-h-[460px]">
                  <div>
                    <div className="flex justify-between items-center pb-3 border-b border-red-200 mb-4">
                      <h3 className="font-black text-red-700 uppercase text-xs tracking-widest flex items-center gap-1.5">
                        🧾 Nueva Orden POS-Venta
                      </h3>
                      <button
                        onClick={() => setPosCart([])}
                        disabled={posCart.length === 0}
                        className="text-xs text-red-600 hover:text-red-800 font-bold disabled:opacity-30 cursor-pointer uppercase tracking-widest text-[9.5px]"
                      >
                        Vaciar Todo
                      </button>
                    </div>

                    <div className="divide-y divide-red-200/50 max-h-72 overflow-y-auto pr-1">
                      {posCart.map((item, index) => (
                        <div key={item.plato.id} className="py-3 flex justify-between items-center text-xs gap-4 text-red-950">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-red-900 text-sm leading-none">{item.plato.nombre}</span>
                              <span className="text-[8.5px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wide">COD {item.plato.id}</span>
                            </div>
                            <span className="text-[10px] text-red-700/80 mt-1 block font-medium">
                              {item.cantidad} x ${Number(item.plato.precio_venta).toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="font-extrabold text-red-700 font-mono text-sm">${item.subtotal.toFixed(2)}</span>
                            <button
                              onClick={() => handlePosRemoveFromCart(index)}
                              className="text-red-400 hover:text-red-900 transition font-black text-sm p-1.5 cursor-pointer bg-red-200 hover:bg-red-300 rounded-lg"
                            >
                              &times;
                            </button>
                          </div>
                        </div>
                      ))}

                      {posCart.length === 0 && (
                        <div className="py-14 text-center text-red-900/60 flex flex-col items-center justify-center space-y-2">
                          <span className="text-4xl filter saturate-50">🛒</span>
                          <p className="text-red-800 text-xs font-black uppercase tracking-wider">Caja Vacía</p>
                          <p className="text-red-600 text-[11px] max-w-xs">Adicione platos en el selector izquierdo para armar el pedido de la mesa.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-red-200/60 pt-6 mt-6">
                    <div className="flex justify-between items-baseline mb-4">
                      <span className="text-xs text-red-800 font-bold uppercase tracking-wider">Total Cuenta:</span>
                      <span className="text-3xl font-black text-red-600 font-mono">
                        ${posCart.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)}
                      </span>
                    </div>

                    <button
                      onClick={handlePosCheckout}
                      disabled={posCart.length === 0}
                      className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest transition shadow-lg shadow-red-200/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Finalizar Venta
                    </button>
                    <p className="text-center text-[9px] text-red-500 mt-3 font-medium">
                      Al confirmar, se guardará en base de datos de manera atómica llamando al Stored Procedure <strong>registrar_venta_detalle</strong>.
                    </p>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* ===============================================================
              VIEW 4: GENERAL DASHBOARD (Kárdex, Producción e Historial Log)
              =============================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xl">
                <h2 className="text-lg font-black text-stone-800 uppercase tracking-tight flex items-center gap-2">
                  📊 Panel de Auditoría de Base de Datos MySQL
                </h2>
                <p className="text-stone-500 text-xs mt-1">
                  Inspección en tiempo real de la tabla unificada de catálogos, el log de transacciones producidas y el despacho comercial de ventas.
                </p>
              </div>

              {/* Grid del Kárdex */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Tabla Total Inventario */}
                <div className="lg:col-span-12 bg-white border border-stone-200 rounded-3xl shadow-xl overflow-hidden p-6 space-y-4">
                  <h3 className="font-black text-stone-800 text-xs flex items-center gap-2 pb-2 border-b uppercase tracking-widest">
                    <Package className="w-5 h-5 text-red-600" />
                    Catálogo de Artículos (Tabla: articulo)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">COD ID</th>
                          <th className="py-3 px-4">Descripción del Artículo</th>
                          <th className="py-3 px-4">Tipo de Artículo</th>
                          <th className="py-3 px-4 text-right">Stock Actual</th>
                          <th className="py-3 px-4 text-right">Mínimo Crítico</th>
                          <th className="py-3 px-4 text-right">Precio Venta (U)</th>
                          <th className="py-3 px-4 text-center">Estado Alerta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {articulos.map(art => {
                          const alertBajo = art.stock_actual < art.stock_minimo;
                          let bgBadge = '';
                          if (art.tipo === 'MATERIA_PRIMA') bgBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                          if (art.tipo === 'SEMI_ELABORADO') bgBadge = 'bg-red-100 text-red-800 border-red-200';
                          if (art.tipo === 'PLATO_FINAL') bgBadge = 'bg-green-100 text-green-800 border-green-200';
                          
                          return (
                            <tr key={art.id} className="hover:bg-stone-50/70 transition-colors">
                              <td className="py-3.5 px-4 font-mono font-bold text-stone-400">#{art.id}</td>
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-stone-800 text-[13px] block">{art.nombre}</span>
                                <span className="text-[10px] text-stone-400">UNIDAD DE MEDIDA: {art.unidad_medida}</span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2.5 py-0.5 rounded border text-[9.5px] font-bold tracking-wider uppercase ${bgBadge}`}>
                                  {art.tipo}
                                </span>
                              </td>
                              <td className={`py-3.5 px-4 text-right font-black text-[13px] ${alertBajo ? 'text-red-700' : 'text-stone-800'}`}>
                                {art.stock_actual.toFixed(1)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono text-stone-500">
                                {art.stock_minimo.toFixed(1)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono text-stone-600">
                                {art.precio_venta ? `$${art.precio_venta.toFixed(2)}` : '-'}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {alertBajo ? (
                                  <span className="px-2.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-black rounded uppercase tracking-wider border border-red-200">
                                    BAJO MÍNIMO
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded uppercase tracking-wider">
                                    ESTABLE
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* logs Historiales - Lado izquierdo produccion / Lado derecho ventas */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  
                  {/* Produccion log */}
                  <div className="bg-white border border-stone-200 rounded-3xl shadow-xl p-6 space-y-4">
                    <h3 className="font-bold text-stone-700 uppercase text-xs tracking-wider pb-2 border-b flex items-center gap-2">
                      <ChefHat className="w-4 h-4 text-red-600" />
                      Última Producción (Tabla: produccion_log)
                    </h3>
                    <div className="overflow-y-auto max-h-72 pr-1">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="text-stone-400 border-b border-stone-200 pb-2 uppercase tracking-wide font-black text-[9px]">
                            <th className="pb-2">Reg ID</th>
                            <th className="pb-2">Semi-Elaborado</th>
                            <th className="pb-2 text-right">Preparado</th>
                            <th className="pb-2 text-right">Fecha</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {historialProduccion.map(p => (
                            <tr key={p.id} className="hover:bg-stone-50/50 py-2.5">
                              <td className="py-3 font-mono text-stone-400">#{p.id}</td>
                              <td className="py-3">
                                <span className="font-bold text-stone-800 block">{p.semi_nombre}</span>
                                <span className="text-[9px] text-stone-400 font-mono">COD #{p.semi_id}</span>
                              </td>
                              <td className="py-3 text-right font-black text-red-600 font-mono">+{p.cantidad} u</td>
                              <td className="py-3 text-right text-stone-400 text-[10px] whitespace-nowrap">{new Date(p.fecha).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                          {historialProduccion.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-stone-400 text-xs">Sin movimientos de cocina registrados.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Ventas log */}
                  <div className="bg-white border border-stone-200 rounded-3xl shadow-xl p-6 space-y-4">
                    <h3 className="font-bold text-stone-700 uppercase text-xs tracking-wider pb-2 border-b flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-red-600" />
                      Historial Ventas (Tabla: venta_detalle)
                    </h3>
                    <div className="overflow-y-auto max-h-72 pr-1">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="text-stone-400 border-b border-stone-200 pb-2 uppercase tracking-wide font-black text-[9px]">
                            <th className="pb-2">Detalle ID</th>
                            <th className="pb-2">TKT Nro</th>
                            <th className="pb-2">Artículo</th>
                            <th className="pb-2 text-right">Cant.</th>
                            <th className="pb-2 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {historialVentas.map(v => (
                            <tr key={v.id} className="hover:bg-stone-50/50 py-2.5">
                              <td className="py-3 font-mono text-stone-400">#{v.id}</td>
                              <td className="py-3 font-mono text-stone-500">TKT #{v.venta_id}</td>
                              <td className="py-3 font-bold text-stone-800">
                                {v.plato_nombre}
                              </td>
                              <td className="py-3 text-right font-mono font-semibold">{v.cantidad} u</td>
                              <td className="py-3 text-right font-black text-red-600 font-mono">${v.subtotal.toFixed(2)}</td>
                            </tr>
                          ))}
                          {historialVentas.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-stone-400 text-xs">Sin ventas registradas en caja demo.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* ===============================================================
              VIEW 5: DELIVERABLES CODE VIEWER (FastAPI / Angular Files)
              =============================================================== */}
          {activeTab === 'codigo' && (
            <div className="space-y-6">
              <div className="bg-stone-900 border border-stone-950 text-white rounded-3xl p-6 shadow-xl leading-relaxed relative">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-sm font-black flex items-center gap-2 text-red-500 uppercase tracking-widest">
                      📂 Código de Entregables Solicitados
                    </h2>
                    <p className="text-stone-400 text-xs mt-1">
                      Explore y copie directamente los archivos listos para producción con la arquitectura de Stored Procedures MySQL y consumo API.
                    </p>
                  </div>
                  
                  <button
                    onClick={() => handleCopyCode(obtenerCodigoArchivo(activeCodeTab))}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs tracking-wider uppercase transition shadow-md flex items-center gap-1.5 cursor-pointer ml-auto"
                  >
                    {copiedText ? (
                      <>
                        <CircleCheck className="w-4 h-4 text-emerald-950" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar archivo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Pestañas del Código */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                {[
                  { id: 'fastapi', title: '🐍 FastAPI' },
                  { id: 'service', title: '📦 Angular (service)' },
                  { id: 'cocina_cmp', title: '🍳 Angular (Cocina)' },
                  { id: 'compras_cmp', title: '🛒 Angular (Compras)' },
                  { id: 'pos_cmp', title: '🏪 Angular (POS)' },
                  { id: 'dash_cmp', title: '📊 Angular (Dash)' },
                ].map(b => (
                  <button
                    key={b.id}
                    onClick={() => { setActiveCodeTab(b.id as any); setCopiedText(false); }}
                    className={`py-2 px-3 text-[10px] font-black rounded-xl border uppercase tracking-wider transition-all cursor-pointer ${
                      activeCodeTab === b.id 
                        ? 'bg-red-600 text-white border-transparent shadow-lg' 
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {b.title}
                  </button>
                ))}
              </div>

              {/* Bloque Pre de Código */}
              <div className="bg-stone-900 rounded-3xl border border-stone-950 shadow-2xl overflow-hidden p-6 relative max-h-[500px] overflow-y-auto font-mono text-[10.5px] leading-relaxed text-stone-300">
                <span className="absolute top-4 right-4 bg-stone-800 text-stone-400 px-2.5 py-1 text-[9px] font-bold rounded tracking-wide border border-stone-750">
                  {obtenerLabelArchivo(activeCodeTab)}
                </span>
                <pre className="whitespace-pre-wrap select-all">{obtenerCodigoArchivo(activeCodeTab)}</pre>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <footer className="bg-white border-t border-stone-200 py-4 text-center text-[10.5px] text-stone-400 shrink-0 select-none">
          <p>© 2026 Pizzería La Tradición • Logística de Materiales con Motor BOM de Base de Datos MySQL.</p>
        </footer>

      </main>

      {/* =======================================================
          MODAL DE PRODUCCIÓN (To-Do de Cocina)
          ======================================================= */}
      {cocinaModalOpen && selectedCocinaArt && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-stone-150">
            <div className="flex justify-between items-center pb-2 border-b border-stone-100">
              <h3 className="text-sm font-black text-stone-800 uppercase tracking-widest">
                Registrar Producción
              </h3>
              <button 
                onClick={() => setCocinaModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {cocinaError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold">
                {cocinaError}
              </div>
            )}

            <div className="space-y-4">
              <p className="text-xs text-stone-500 leading-relaxed">
                Ingresa la cantidad final obtenida de <strong>{selectedCocinaArt.nombre}</strong> para actualizar el stock y descontar ingredientes en base al BOM de receta.
              </p>

              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                  Cantidad Producida ({selectedCocinaArt.unidad_medida})
                </label>
                <input
                  type="number"
                  value={cantidadProducir}
                  onChange={(e) => setCantidadProducir(Math.max(1, parseInt(e.target.value, 15) || 1))}
                  className="w-full p-3 bg-stone-50 rounded-2xl border-2 border-stone-100 text-lg font-bold mb-1 focus:border-red-500 outline-none transition-all"
                  min="1"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCocinaModalOpen(false)}
                className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold rounded-2xl text-[11px] uppercase cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarProduccion}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-[11px] uppercase cursor-pointer transition-colors shadow-lg"
              >
                Confirmar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Helper para catalogar los codigos para visualización directa en pantalla
function obtenerLabelArchivo(tab: string): string {
  switch (tab) {
    case 'fastapi': return 'backend/main.py';
    case 'service': return 'app/services/articulo.service.ts';
    case 'cocina_cmp': return 'app/components/produccion-cocina (TS/HTML)';
    case 'compras_cmp': return 'app/components/panel-compras (TS/HTML)';
    case 'pos_cmp': return 'app/components/punto-venta (TS/HTML)';
    case 'dash_cmp': return 'app/components/dashboard-stock (TS/HTML)';
    default: return 'archivo.ts';
  }
}

function obtenerCodigoArchivo(tab: string): string {
  switch (tab) {
    case 'fastapi':
      return `# =======================================================
# ARCHIVO: /backend_fastapi/main.py (FastAPI Backend Server)
# =======================================================
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import os
import mysql.connector
from mysql.connector import pooling

app = FastAPI(title="Pizzeria BOM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pool de conexiones MySQL
db_pool = pooling.MySQLConnectionPool(
    pool_name="pizzeria_pool",
    pool_size=5,
    host=os.getenv("DB_HOST", "localhost"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "pizzeria_db")
)

def get_db():
    conn = db_pool.get_connection()
    try:
        yield conn
    finally:
        conn.close()

# Modelos Pydantic
class ArticuloResponse(BaseModel):
    id: int
    nombre: str
    tipo: str
    unidad_medida: str
    stock_actual: float
    stock_minimo: float
    precio_venta: Optional[float] = None

class ProduccionRequest(BaseModel):
    semi_id: int
    cantidad: int

class VentaDetalleItem(BaseModel):
    plato_id: int
    cantidad: int

class VentaRequest(BaseModel):
    detalles: List[VentaDetalleItem]

@app.get("/api/articulos/cocina", response_model=List[ArticuloResponse])
def get_articulos_cocina(conn=Depends(get_db)):
    """ To-Do list de Cocina: SEMI_ELABORADO con stock < stock_minimo """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM articulo WHERE tipo = 'SEMI_ELABORADO' AND stock_actual < stock_minimo")
        return cursor.fetchall()
    finally:
        cursor.close()

@app.post("/api/produccion")
def registrar_produccion_cocina(payload: ProduccionRequest, conn=Depends(get_db)):
    """ Llama al SP 'registrar_produccion' para sumar stock y descontar de inventario """
    cursor = conn.cursor()
    try:
        # LLAMADA AL SP DE MYSQL
        cursor.callproc("registrar_produccion", (payload.semi_id, payload.cantidad))
        conn.commit()
        return {"status": "success", "message": "Producción cocina registrada y BOM descontado correctamente."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()

@app.get("/api/articulos/materia_prima", response_model=List[ArticuloResponse])
def get_materia_prima(conn=Depends(get_db)):
    """ Panel de Compras: Articulos de tipo MATERIA_PRIMA """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM articulo WHERE tipo = 'MATERIA_PRIMA'")
        return cursor.fetchall()
    finally:
        cursor.close()

@app.get("/platos/finales", response_model=List[ArticuloResponse])
def get_platos_finales_simple(conn=Depends(get_db)):
    """ Punto de Venta: Retorna la lista de todos los platos finales """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM articulo WHERE tipo = 'PLATO_FINAL'")
        return cursor.fetchall()
    finally:
        cursor.close()

@app.post("/api/ventas")
def registrar_venta(payload: VentaRequest, conn=Depends(get_db)):
    """ Crea Cabecera de Venta y por cada item llama al SP 'registrar_venta_detalle' """
    cursor = conn.cursor()
    try:
        conn.start_transaction()
        # 1. Calcular total y registrar cabecera (Venta)
        cursor.execute("INSERT INTO venta (total) VALUES (0)") # En ambiente real se calcula
        venta_id = cursor.lastrowid

        # 2. Registrar detalles en bucle ejecutando el SP
        for item in payload.detalles:
            cursor.callproc("registrar_venta_detalle", (venta_id, item.plato_id, item.cantidad))
            
        conn.commit()
        return {"status": "success", "venta_id": venta_id, "message": "Venta procesada exitosamente."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
`;

    case 'service':
      return `/* =======================================================
   ARCHIVO: /frontend_angular/src/app/services/articulo.service.ts
   ======================================================= */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Articulo {
  id: number;
  nombre: string;
  tipo: 'MATERIA_PRIMA' | 'SEMI_ELABORADO' | 'PLATO_FINAL';
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  precio_venta?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ArticuloService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  getArticulosCocina(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(_ + this.apiUrl + '/articulos/cocina');
  }

  registrarProduccion(req: { semi_id: number, cantidad: number }): Observable<any> {
    return this.http.post<any>(_ + this.apiUrl + '/produccion', req);
  }

  getMateriasPrimas(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(_ + this.apiUrl + '/articulos/materia_prima');
  }

  getPlatosFinales(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(_ + this.apiUrl + '/articulos/plato_final');
  }

  registrarVenta(req: { detalles: { plato_id: number, cantidad: number }[] }): Observable<any> {
    return this.http.post<any>(_ + this.apiUrl + '/ventas', req);
  }

  getInventarioCompleto(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>(_ + this.apiUrl + '/dashboard/inventario');
  }

  getHistorialProduccion(): Observable<any[]> {
    return this.http.get<any[]>(_ + this.apiUrl + '/dashboard/historial-produccion');
  }

  getHistorialVentas(): Observable<any[]> {
    return this.http.get<any[]>(_ + this.apiUrl + '/dashboard/historial-ventas');
  }
}
`.replace(/_/g, "");

    case 'cocina_cmp':
      return `<!-- =======================================================
     A) VISTA HTML (produccion-cocina.component.html)
     ======================================================= -->
<div class="p-6 max-w-6xl mx-auto">
  <h2 class="text-2xl font-bold mb-1">To-Do de Producción (Cocina)</h2>
  <p class="text-sm text-gray-500 mb-6">Cocina: Artículos semi-elaborados bajo stock mínimo.</p>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div *ngFor="let item of articulosBajos" class="border border-red-200 bg-white p-5 rounded-xl shadow-sm relative">
      <div class="absolute top-4 right-4 text-xs font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded">⚠️ Faltante</div>
      <h3 class="font-bold text-gray-900">{{item.nombre}}</h3>
      <p class="text-xs text-gray-400">ID Articulo #{{item.id}}</p>

      <div class="my-4 text-sm bg-gray-50 p-3 rounded">
        <div>Stock Actual: <strong class="text-rose-600">{{item.stock_actual}}</strong></div>
        <div>Stock Mínimo: <strong>{{item.stock_minimo}}</strong></div>
      </div>

      <!-- Icono de alerta obligatorio si tras sumar sigue bajo minimo -->
      <div class="text-xs text-amber-800 bg-amber-50 p-2 rounded mb-3 border border-amber-100 flex items-center gap-1">
        <span>⚠️ Sigue por debajo del inventario mínimo de seguridad</span>
      </div>

      <button (click)="abrirModal(item)" class="w-full py-2 bg-indigo-600 text-white rounded text-sm font-semibold">
        Marcar como Hecho
      </button>
    </div>
  </div>

  <!-- Modal/Formulario de registro integrado -->
  <div *ngIf="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div class="bg-white p-6 rounded-lg max-w-md w-full">
      <h3 class="font-bold text-lg mb-4">Ingrese Cantidad Producida</h3>
      <input type="number" [(ngModel)]="cantidadAProducir" class="border p-2 w-full mb-4" />
      <div class="flex justify-end gap-2">
        <button (click)="showModal = false" class="px-4 py-2 border rounded">Cancelar</button>
        <button (click)="confirmar()" class="px-4 py-2 bg-emerald-600 text-white rounded">Guardar</button>
      </div>
    </div>
  </div>
</div>

/* =======================================================
   B) CONTROLADOR TS (produccion-cocina.component.ts)
   ======================================================= */
import { Component, OnInit } from '@angular/core';
import { ArticuloService, Articulo } from '../../services/articulo.service';

@Component({
  selector: 'app-produccion-cocina',
  templateUrl: './produccion-cocina.component.html'
})
export class ProduccionCocinaComponent implements OnInit {
  articulosBajos: Articulo[] = [];
  showModal = false;
  selectedArt: Articulo | null = null;
  cantidadAProducir = 1;

  constructor(private artService: ArticuloService) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.artService.getArticulosCocina().subscribe(data => this.articulosBajos = data);
  }

  abrirModal(art: Articulo) {
    this.selectedArt = art;
    this.showModal = true;
  }

  confirmar() {
    if (!this.selectedArt) return;
    this.artService.registrarProduccion({
      semi_id: this.selectedArt.id,
      cantidad: this.cantidadAProducir
    }).subscribe(() => {
      this.showModal = false;
      this.cargar(); // Al recargar, si sumado sigue menor a min, NO desaparece
    });
  }
}
`;

    case 'compras_cmp':
      return `<!-- =======================================================
     A) VISTA HTML (panel-compras.component.html)
     ======================================================= -->
<div class="p-6 max-w-6xl mx-auto">
  <h2 class="text-2xl font-bold mb-4">🛒 Panel de Compras / Materia Prima</h2>

  <div class="bg-white border rounded-xl overflow-hidden shadow-sm">
    <table class="w-full">
      <thead class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
        <tr>
          <th class="py-4 px-6 text-left">Código</th>
          <th class="py-4 px-6 text-left">Nombre Insumo</th>
          <th class="py-4 px-6 text-right">Stock Actual</th>
          <th class="py-4 px-6 text-right">Stock Mínimo</th>
          <th class="py-4 px-6">Unidad</th>
        </tr>
      </thead>
      <tbody class="divide-y text-sm">
        <tr *ngFor="let MP of materiasPrimas" 
          [ngClass]="{'bg-red-50 text-red-900 border-l-4 border-red-500': MP.stock_actual < MP.stock_minimo, 'hover:bg-gray-55': MP.stock_actual >= MP.stock_minimo}">
          <!-- Logica: Si stock_actual < stock_minimo, fila con fondo rojo claro -->
          <td class="py-4 px-6">#{{MP.id}}</td>
          <td class="py-4 px-6 font-semibold">{{MP.nombre}}</td>
          <td class="py-4 px-6 text-right font-bold">{{MP.stock_actual}}</td>
          <td class="py-4 px-6 text-right">{{MP.stock_minimo}}</td>
          <td class="py-4 px-6">{{MP.unidad_medida}}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

/* =======================================================
   B) CONTROLADOR TS (panel-compras.component.ts)
   ======================================================= */
import { Component, OnInit } from '@angular/core';
import { ArticuloService, Articulo } from '../../services/articulo.service';

@Component({
  selector: 'app-panel-compras',
  templateUrl: './panel-compras.component.html'
})
export class PanelComprasComponent implements OnInit {
  materiasPrimas: Articulo[] = [];

  constructor(private artService: ArticuloService) {}

  ngOnInit() {
    this.artService.getMateriasPrimas().subscribe(list => this.materiasPrimas = list);
  }
}
`;

    case 'pos_cmp':
      return `<!-- =======================================================
     A) VISTA HTML (punto-venta.component.html)
     ======================================================= -->
<div class="p-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
  <div class="md:col-span-6 bg-white p-6 border rounded-xl">
    <h3 class="text-lg font-bold mb-4">Adicionar Plato</h3>
    <select [(ngModel)]="selectedPlatoId" class="border p-2.5 w-full rounded mb-4">
      <option value="" disabled selected>Elige Artículo...</option>
      <option *ngFor="let p of platos" [value]="p.id">{{p.nombre}} - $ {{p.precio_venta}}</option>
    </select>
    <input type="number" [(ngModel)]="cantidad" min="1" class="border p-2 w-full rounded mb-4" />
    <button (click)="agregar()" class="w-full bg-indigo-600 text-white font-bold py-2 rounded">Adicionar</button>
  </div>

  <div class="md:col-span-6 bg-gray-900 text-white p-6 rounded-xl flex flex-col justify-between">
    <div>
      <h3 class="border-b border-gray-800 pb-2 font-bold mb-4">🛒 Carrito de Mesas</h3>
      <div *ngFor="let item of carrito" class="flex justify-between py-2 border-b border-gray-800">
        <span>{{item.plato.nombre}} x {{item.cantidad}}</span>
        <span class="text-emerald-400 font-mono">\${{item.plato.precio_venta * item.cantidad | number}}</span>
      </div>
    </div>
    
    <div class="mt-6 border-t border-gray-800 pt-4">
      <div class="flex justify-between font-bold text-lg mb-4">
        <span>Total:</span>
        <span class="text-emerald-400 font-mono">\${{obtenerTotal()}}</span>
      </div>
      <button (click)="confirmar()" [disabled]="carrito.length === 0" class="w-full bg-emerald-600 text-white py-3 rounded font-bold">
        Confirmar Venta
      </button>
    </div>
  </div>
</div>

/* =======================================================
   B) CONTROLADOR TS (punto-venta.component.ts)
   ======================================================= */
import { Component, OnInit } from '@angular/core';
import { ArticuloService, Articulo } from '../../services/articulo.service';

@Component({
  selector: 'app-punto-venta',
  templateUrl: './punto-venta.component.html'
})
export class PuntoVentaComponent implements OnInit {
  platos: Articulo[] = [];
  selectedPlatoId = '';
  cantidad = 1;
  carrito: { plato: Articulo, cantidad: number }[] = [];

  constructor(private artService: ArticuloService) {}

  ngOnInit() {
    this.artService.getPlatosFinales().subscribe(p => this.platos = p);
  }

  agregar() {
    const id = parseInt(this.selectedPlatoId, 10);
    const plato = this.platos.find(item => item.id === id);
    if (plato) {
      this.carrito.push({ plato, cantidad: this.cantidad });
      this.selectedPlatoId = '';
      this.cantidad = 1;
    }
  }

  obtenerTotal() {
    return this.carrito.reduce((sum, item) => sum + ((item.plato.precio_venta || 0) * item.cantidad), 0);
  }

  confirmar() {
    const req = {
      detalles: this.carrito.map(item => ({ plato_id: item.plato.id, cantidad: item.cantidad }))
    };
    this.artService.registrarVenta(req).subscribe(() => {
      alert('Venta ingresada correctamente. Cascadas de stock deducidas.');
      this.carrito = [];
    });
  }
}
`;

    case 'dash_cmp':
      return `<!-- =======================================================
     A) VISTA HTML (dashboard-stock.component.html)
     ======================================================= -->
<div class="p-6 max-w-6xl mx-auto space-y-8">
  <h2 class="text-2xl font-bold mb-4">📊 Dashboard e Historiales</h2>

  <!-- INVENTARIO COMPLETO (KÁRDEX) -->
  <div class="bg-white border rounded-xl overflow-hidden p-6 shadow-sm">
    <h3 class="font-bold text-lg mb-4">📦 Inventario Completo de Artículos</h3>
    <table class="w-full">
      <thead class="bg-gray-50 text-xs">
        <tr>
          <th class="py-3 px-4 text-left">Artículo</th>
          <th class="py-3 px-4">Tipo</th>
          <th class="py-3 px-4 text-right">Stock Actual</th>
          <th class="py-3 px-4 text-right">Mínimo</th>
          <th class="py-3 px-4 text-center">Estado</th>
        </tr>
      </thead>
      <tbody class="divide-y text-xs text-gray-700">
        <tr *ngFor="let item of inventario">
          <td class="py-3 px-4 font-bold">{{item.nombre}}</td>
          <td class="py-3 px-4 uppercase">{{item.tipo}}</td>
          <td class="py-3 px-4 text-right font-bold">{{item.stock_actual}}</td>
          <td class="py-3 px-4 text-right">{{item.stock_minimo}}</td>
          <td class="py-3 px-4 text-center">
            <span *ngIf="item.stock_actual < item.stock_minimo" class="bg-red-100 text-red-800 text-[10px] px-2.5 py-1 rounded font-bold">ALERTA</span>
            <span *ngIf="item.stock_actual >= item.stock_minimo" class="bg-green-100 text-green-800 text-[10px] px-2.5 py-1 rounded">ESTABLE</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- DOS TABLAS SIMPLES CON EL HISTORIAL -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- HISTORIAL DE PRODUCCIÓN -->
    <div class="bg-white p-5 border rounded-xl shadow-sm">
      <h3 class="font-bold text-md mb-3">👩‍🍳 Historial de Producción (Cocina)</h3>
      <table class="w-full text-xs">
        <thead class="border-b pb-2 uppercase text-gray-400">
          <tr>
            <th class="text-left pb-1">Artículo</th>
            <th class="text-right pb-1">Cantidad</th>
            <th class="pb-1 text-right">Fecha</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr *ngFor="let log of hProduccion" class="hover:bg-slate-50">
            <td class="py-2">{{log.semi_nombre}}</td>
            <td class="py-2 text-right text-indigo-600 font-bold">+{{log.cantidad}}</td>
            <td class="py-2 text-right text-gray-400">{{log.fecha | date:'short'}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- HISTORIAL DE VENTAS -->
    <div class="bg-white p-5 border rounded-xl shadow-sm">
      <h3 class="font-bold text-md mb-3">💰 Historial de Ventas (Plato Final)</h3>
      <table class="w-full text-xs">
        <thead class="border-b pb-2 uppercase text-gray-400">
          <tr>
            <th class="text-left pb-1">Plato</th>
            <th class="text-right pb-1">Cant.</th>
            <th class="pb-1 text-right">Monto</th>
          </tr>
        </thead>
        <tbody class="divide-y font-sans">
          <tr *ngFor="let log of hVentas" class="hover:bg-slate-50">
            <td class="py-2 font-bold">{{log.plato_nombre}}</td>
            <td class="py-2 text-right font-semibold">{{log.cantidad}} u</td>
            <td class="py-2 text-right text-emerald-600 font-bold">$ {{log.subtotal}}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

/* =======================================================
   B) CONTROLADOR TS (dashboard-stock.component.ts)
   ======================================================= */
import { Component, OnInit } from '@angular/core';
import { ArticuloService, Articulo } from '../../services/articulo.service';

@Component({
  selector: 'app-dashboard-stock',
  templateUrl: './dashboard-stock.component.html'
})
export class DashboardStockComponent implements OnInit {
  inventario: Articulo[] = [];
  hProduccion: any[] = [];
  hVentas: any[] = [];

  constructor(private artService: ArticuloService) {}

  ngOnInit() {
    this.artService.getInventarioCompleto().subscribe(data => this.inventario = data);
    this.artService.getHistorialProduccion().subscribe(data => this.hProduccion = data);
    this.artService.getHistorialVentas().subscribe(data => this.hVentas = data);
  }
}
`;

    default:
      return '';
  }
}
