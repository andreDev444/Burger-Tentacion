// --- 1. MODELO (Gestión de datos) ---
class PedidoModel {
    constructor() {
        this.carrito = [];
        this.total = 0;
        this.adicionesTotal = 0;

        this.coordenadasCliente = null;
        this.sedeMasCercana = null;
        this.costoDomicilio = 0;
        this.tiempoEstimado = "";
        this.distanciaKm = 0;

        // OPTIMIZACIÓN: Ya no están fijas (hardcoded). Se cargan dinámicamente desde la BD.
        this.sedes = []; 
    }

    // Nueva función para traer las sedes de la base de datos a través de la API
    async obtenerSedes() {
        try {
            const res = await fetch('http://localhost:3000/sedes');
            this.sedes = await res.json();
            return this.sedes;
        } catch (err) {
            console.error("Error al obtener sedes de la BD:", err);
            this.sedes = [];
        }
    }

    calcularDistancia(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; 
    }

    evaluarSedeCercana(latCliente, lngCliente) {
        this.coordenadasCliente = { lat: latCliente, lng: lngCliente };
        let distanciaMinima = Infinity;
        let sedeSeleccionada = null;

        // Si por algún motivo no han cargado las sedes, no se calcula
        if (this.sedes.length === 0) return;

        // OPTIMIZACIÓN: Ahora recorremos un Array dinámico mapeado desde la BD
        this.sedes.forEach(sede => {
            // SQL Server entrega latitud/longitud. Mapeamos compatible con nombres de propiedades
            const latSede = parseFloat(sede.latitud || sede.lat);
            const lngSede = parseFloat(sede.longitud || sede.lng);

            if (!isNaN(latSede) && !isNaN(lngSede)) {
                const dist = this.calcularDistancia(latCliente, lngCliente, latSede, lngSede);
                if (dist < distanciaMinima) {
                    distanciaMinima = dist;
                    sedeSeleccionada = sede;
                }
            }
        });

        this.distanciaKm = distanciaMinima;
        this.sedeMasCercana = sedeSeleccionada;

        if (distanciaMinima <= 1.5) {
            this.costoDomicilio = 2500;
            this.tiempoEstimado = "15 a 20 minutos (¡Súper rápido!)";
        } else if (distanciaMinima <= 3.0) {
            this.costoDomicilio = 4000;
            this.tiempoEstimado = "20 a 30 minutos";
        } else if (distanciaMinima <= 4.0) {
            this.costoDomicilio = 5500;
            this.tiempoEstimado = "30 a 40 minutos";
        } else {
            this.costoDomicilio = -1; 
            this.tiempoEstimado = "No disponible";
        }
    }

    async obtenerProductos() {
        const res = await fetch('http://localhost:3000/productos');
        return await res.json();
    }

    agregarAlCarrito(producto) {
        this.carrito.push(producto);
        this.calcularTotal();
    }

    calcularTotal() {
        const base = this.carrito.reduce((sum, p) => sum + p.precio_unitario, 0);
        const costoEnvio = this.costoDomicilio > 0 ? this.costoDomicilio : 0;
        this.total = base + this.adicionesTotal + costoEnvio;
    }

    async enviarPedido(datos) {
        const res = await fetch('http://localhost:3000/ordenar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        return res;
    }
}

// --- 2. VISTA (Manipulación del DOM) ---
class PedidoView {
    renderizarCatalogo(productos) {
        const containerH = document.getElementById('hamburguesas');
        const containerA = document.getElementById('acompanantes');

        productos.forEach(p => {
            const html = `
                <div class="card">
                    <img src="${p.imagen}" alt="${p.nombre}">
                    <h4>${p.nombre}</h4>
                    <p>$${p.precio_base.toLocaleString()}</p>
                    <button class="btn-add" onclick="app.agregar(${p.id_producto}, '${p.nombre}', ${p.precio_base})">Agregar</button>
                </div>`;
            
            if (p.categoria === 'hamburguesa') containerH.innerHTML += html;
            if (p.categoria === 'acompanante' || p.categoria === 'bebida') containerA.innerHTML += html;
        });
    }

    actualizarCarritoUI(carrito, totalFinal, costoDomicilio, tiempo, sede) {
        const lista = document.getElementById('lista-carrito');
        lista.innerHTML = carrito.length === 0 ? '<p>No hay productos seleccionados</p>' : '';
        
        carrito.forEach(item => {
            lista.innerHTML += `
                <div class="item-carrito">
                    <span>${item.nombre}</span>
                    <span>$${item.precio_unitario.toLocaleString()}</span>
                </div>`;
        });

        document.getElementById('total-final').innerText = totalFinal.toLocaleString();
        
        let infoDomicilio = document.getElementById('info-domicilio-dinamico');
        if (!infoDomicilio) {
            infoDomicilio = document.createElement('div');
            infoDomicilio.id = 'info-domicilio-dinamico';
            infoDomicilio.style = "color: #aaa; font-size: 13px; margin-top: 10px; padding: 5px;";
            document.getElementById('formPedido').insertBefore(infoDomicilio, document.getElementById('formPedido').lastElementChild);
        }

        if (costoDomicilio === -1) {
            infoDomicilio.innerHTML = `<span style="color:#D12429; font-weight:bold;">❌ Fuera de zona de cobertura de nuestras sedes.</span>`;
        } else if (costoDomicilio > 0 && sede) {
            infoDomicilio.innerHTML = `   Envío desde: <strong>${sede.nombre}</strong><br>
                                          Valor domicilio: $${costoDomicilio.toLocaleString()}<br>
                                          Tiempo estimado: ${tiempo}`;
        } else {
            infoDomicilio.innerHTML = `📍 Calculando cobertura y sede más cercana...`;
        }
    }
}

// --- 3. CONTROLADOR (Intermediario) ---
class PedidoController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.init();
    }

    async init() {
        try {
            // OPTIMIZACIÓN: Primero traemos de forma asíncrona las sedes de la BD, luego el catálogo
            await this.model.obtenerSedes();
            
            const productos = await this.model.obtenerProductos();
            this.view.renderizarCatalogo(productos);
        } catch (err) {
            console.error("Error al cargar catálogo o sedes:", err);
        }
        this.solicitarGeolocalizacion(); 
        this.setupEventListeners();
    }

    solicitarGeolocalizacion() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    this.model.evaluarSedeCercana(latitude, longitude);
                    this.recalcular();
                },
                (error) => {
                    console.warn("El usuario denegó la ubicación o hubo un error:", error);
                    this.model.costoDomicilio = 0;
                    this.recalcular();
                }
            );
        }
    }

    recalcular() {
        this.model.calcularTotal();
        this.view.actualizarCarritoUI(
            this.model.carrito, 
            this.model.total, 
            this.model.costoDomicilio, 
            this.model.tiempoEstimado,
            this.model.sedeMasCercana
        );
    }

    agregar(id, nombre, precio) {
        this.model.agregarAlCarrito({ id_producto: id, nombre, precio_unitario: precio });
        this.recalcular();
    }

    setupEventListeners() {
        document.querySelectorAll('.adicion').forEach(check => {
            check.addEventListener('change', () => {
                let extra = 0;
                document.querySelectorAll('.adicion:checked').forEach(c => extra += parseInt(c.dataset.precio));
                this.model.adicionesTotal = extra;
                this.recalcular();
            });
        });

        document.getElementById('formPedido').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (this.model.carrito.length === 0) return alert("Carrito vacío");
            
            if (this.model.costoDomicilio === -1) {
                alert("❌ Lo sentimos. Tu dirección actual está muy lejos de nuestras sedes registradas (" + this.model.distanciaKm.toFixed(1) + " km). El servicio de domicilio no está disponible en tu zona.");
                return; 
            }

            // OPTIMIZACIÓN: Se extrae de manera segura el id_sede sin importar la estructura que venga de la BD
            const idSedeAsignada = this.model.sedeMasCercana.id_sede || this.model.sedeMasCercana.id;

            const datosEnvio = {
                cliente: {
                    nombre: document.getElementById('nombre_cliente').value,
                    telefono: document.getElementById('telefono').value,
                    direccion: document.getElementById('direccion').value
                },
                metodo_pago: document.getElementById('metodo_pago').value,
                id_sede: idSedeAsignada, 
                total: this.model.total,
                productos: this.model.carrito,
                notes: `Sede asignada por GPS: ${this.model.sedeMasCercana.nombre} | Tiempo estimado: ${this.model.tiempoEstimado}`
            };

            try {
                const res = await this.model.enviarPedido(datosEnvio);
                if (res.ok) {
                    alert(`¡Pedido confirmado con éxito! ✅\n\nTu orden será despachada desde la sede ${this.model.sedeMasCercana.nombre}.\nTiempo estimado de entrega: ${this.model.tiempoEstimado}.\n¡Muchas gracias por elegir Burger Tentación!`);
                    location.reload();
                } else {
                    alert("❌ Hubo un problema al registrar tu pedido en el servidor.");
                }
            } catch (err) {
                console.error("Error al enviar pedido:", err);
                alert("❌ Error de conexión con el servidor.");
            }
        });
    }
}

// Inicializar la aplicación de manera global
const app = new PedidoController(new PedidoModel(), new PedidoView());