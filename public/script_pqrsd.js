const API_URL = "http://localhost:3000/pqrsd";

// ==========================================
// 1. MODELO (Manejo de Datos y API)
// ==========================================
class PqrModel {
    async obtenerTodos() {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error("Error cargando datos");
        return await res.json();
    }

    async guardar(nuevaPQR) {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nuevaPQR)
        });
        if (!res.ok) throw new Error("Error al enviar");
        return res;
    }

    async eliminar(id) {
        const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Error eliminando");
        return res;
    }

    async responder(id, respuestaAdmin) {
        const res = await fetch(`${API_URL}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ respuesta: respuestaAdmin })
        });
        if (!res.ok) throw new Error("Error respondiendo");
        return res;
    }
}

// ==========================================
// 2. VISTA (Manipulación del DOM)
// ==========================================
class PqrView {
    constructor() {
        this.tabla = document.getElementById("tablaPQRSD");
        this.formulario = document.getElementById("formularioPQRSD");
    }

    mostrarCargando() {
        this.tabla.innerHTML = `<tr><td colspan="6">Cargando datos...</td></tr>`;
    }

    mostrarError(mensaje) {
        this.tabla.innerHTML = `<tr><td colspan="6">❌ ${mensaje}</td></tr>`;
    }

    renderizarTabla(datos) {
        this.tabla.innerHTML = "";

        if (datos.length === 0) {
            this.tabla.innerHTML = `<tr><td colspan="6">No hay solicitudes registradas</td></tr>`;
            return;
        }

        datos.forEach((pqr) => {
            const fecha = pqr.fecha_creacion 
                ? new Date(pqr.fecha_creacion).toLocaleDateString() 
                : "Sin fecha";

            const fila = `
                <tr>
                    <td>${pqr.tipo || "Sin tipo"}</td>
                    <td>${pqr.asunto || "Sin asunto"}</td>
                    <td><strong>${pqr.estado || "Pendiente"}</strong></td>
                    <td>${pqr.respuesta_admin || "Sin respuesta"}</td>
                    <td>${fecha}</td>
                    <td>
                        <button class="btn-responder" onclick='app.handleResponder(${JSON.stringify(pqr)})'>
                            📩 Responder
                        </button>
                        <button class="btn-eliminar" onclick="app.handleEliminar(${pqr.id_pqrsd})">
                            ------ Borrar -------
                        </button>
                    </td>
                </tr>`;
            this.tabla.innerHTML += fila;
        });
    }

    obtenerDatosFormulario() {
        return {
            nombre: document.getElementById("nombre").value,
            correo: document.getElementById("correo").value,
            telefono: document.getElementById("telefono").value,
            tipo: document.getElementById("tipo").value,
            asunto: document.getElementById("asunto").value,
            mensaje: document.getElementById("mensaje").value
        };
    }

    limpiarFormulario() {
        if (this.formulario) this.formulario.reset();
    }
}

// ==========================================
// 3. CONTROLADOR (Orquestador de Lógica)
// ==========================================
class PqrController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.init();
    }

    async init() {
        document.addEventListener("DOMContentLoaded", () => this.cargarPQRSD());
        
        if (this.view.formulario) {
            this.view.formulario.addEventListener("submit", (e) => this.handleGuardar(e));
        }
    }

    async cargarPQRSD() {
        try {
            const datos = await this.model.obtenerTodos();
            this.view.renderizarTabla(datos);
        } catch (error) {
            console.error(error);
            this.view.mostrarError("Error cargando datos");
        }
    }

    async handleGuardar(e) {
        e.preventDefault();
        const nuevaPQR = this.view.obtenerDatosFormulario();

        try {
            await this.model.guardar(nuevaPQR);
            alert("✅ PQRSD enviado correctamente");
            this.view.limpiarFormulario();
            this.cargarPQRSD();
        } catch (error) {
            console.error(error);
            alert("❌ Error al enviar solicitud");
        }
    }

    async handleEliminar(id) {
        if (!confirm("¿Deseas eliminar esta solicitud?")) return;

        try {
            await this.model.eliminar(id);
            alert("🗑️ Registro eliminado");
            this.cargarPQRSD();
        } catch (error) {
            console.error(error);
            alert("❌ Error al eliminar");
        }
    }

    async handleResponder(pqr) {
        const respuestaAdmin = prompt(
            `MENSAJE DEL CLIENTE:\n\n${pqr.mensaje}\n\n--------------------------------\nEscribe la respuesta oficial:`
        );

        if (!respuestaAdmin || respuestaAdmin.trim() === "") return;

        try {
            await this.model.responder(pqr.id_pqrsd, respuestaAdmin);
            alert("✅ Respuesta enviada");
            this.cargarPQRSD();
        } catch (error) {
            console.error(error);
            alert("❌ Error al responder");
        }
    }
}

// ==========================================
// INICIALIZACIÓN DE LA APP
// ==========================================
const app = new PqrController(new PqrModel(), new PqrView());