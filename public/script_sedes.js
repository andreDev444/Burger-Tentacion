// ======================================================
// 1. MODELO (Datos y Lógica de Negocio)
// ======================================================
class SedesModel {
    constructor() {
        this.storesDatabase = [];
        this.mapLocations = ["Medellín", "Cali", "Bogotá", "Barranquilla"];
    }

    // OPTIMIZACIÓN CRÍTICA: Eliminadas coordenadas "hardcoded". 
    // Ahora consume la geolocalización real inyectada desde SQL Server.
    async fetchSedes() {
        const response = await fetch("http://localhost:3000/sedes");
        if (!response.ok) throw new Error("No se pudieron cargar las sedes");
        const data = await response.json();

        this.storesDatabase = data.map((sede) => {
            // Extraer la ciudad a partir del nombre o dirección de la sede de forma dinámica
            let ciudadDetectada = "Colombia";
            if (sede.nombre.toLowerCase().includes("medellín")) ciudadDetectada = "Medellín";
            else if (sede.nombre.toLowerCase().includes("bogotá")) ciudadDetectada = "Bogotá";
            else if (sede.nombre.toLowerCase().includes("cali")) ciudadDetectada = "Cali";
            else if (sede.nombre.toLowerCase().includes("barranquilla")) ciudadDetectada = "Barranquilla";

            return {
                id: sede.id_sede,
                nombre: sede.nombre,
                direccion: sede.direccion,
                ciudad: ciudadDetectada,
                horario: "Abierto hasta las 22:00", // Puede parametrizarse en BD en el futuro
                lat: parseFloat(sede.latitud) || 4.5709, // Fallback a mapa de Colombia si es null
                lng: parseFloat(sede.longitud) || -74.2973
            };
        });
        return this.storesDatabase;
    }

    filterStores(searchTerm) {
        if (!searchTerm.trim()) return this.storesDatabase;
        const term = searchTerm.toLowerCase();
        return this.storesDatabase.filter(store => 
            store.nombre.toLowerCase().includes(term) ||
            store.direccion.toLowerCase().includes(term) ||
            store.ciudad.toLowerCase().includes(term)
        );
    }
}

// ======================================================
// 2. VISTA (Interfaz de Usuario y Mapas)
// ======================================================
class SedesView {
    constructor() {
        this.currentMap = null;
        this.markers = [];
    }

    initMap() {
        if (this.currentMap !== null) this.currentMap.remove();
        // Inicializa el mapa centrado en Colombia
        this.currentMap = L.map("realMap").setView([4.5709, -74.2973], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(this.currentMap);
    }

    renderLocationsTags(locations, onTagClick) {
        const list = document.getElementById("locationsList");
        list.innerHTML = locations.map(city => `
            <span class="location-tag" style="padding:8px 14px; background:#ff8c00; color:#000; font-weight:bold; border-radius:20px; cursor:pointer; margin:5px; display:inline-block;">
                ${city}
            </span>
        `).join("");

        list.querySelectorAll(".location-tag").forEach(tag => {
            tag.addEventListener("click", () => onTagClick(tag.textContent.trim()));
        });
    }

    renderStoresList(stores) {
        const list = document.getElementById("storesList");
        if (stores.length === 0) {
            list.innerHTML = `<div style="padding:20px; color:#cbd5e1;">No se encontraron sedes</div>`;
            return;
        }

        list.innerHTML = stores.map(store => `
            <div class="store-item" onclick="window.appSedes.centrarEnTienda(${store.id})" style="padding:15px; border-bottom:1px solid #333; cursor:pointer; color:#fff;">
                <h3 style="margin:0 0 5px 0; color:#ff8c00;">${store.nombre}</h3>
                <p style="margin:0 0 5px 0; font-size:14px; color:#94a3b8;">${store.direccion}</p>
                <small style="color:#64748b;">${store.horario}</small>
            </div>
        `).join("");
    }

    updateMarkers(stores) {
        this.markers.forEach(m => this.currentMap.removeLayer(m));
        this.markers = [];

        const redIcon = L.icon({
            iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        });

        stores.forEach(store => {
            const marker = L.marker([store.lat, store.lng], { icon: redIcon })
                .addTo(this.currentMap)
                .bindPopup(`
                    <div style="color:#000; font-family:sans-serif;">
                        <strong>${store.nombre}</strong><br>${store.direccion}<br>🕒 ${store.horario}<br><br>
                        <button onclick="window.appSedes.centrarEnTienda(${store.id})" style="background:#ff8c00; color:black; border:none; padding:6px 12px; border-radius:12px; cursor:pointer; font-weight:bold; width:100%;">
                            📍 Enfocar
                        </button>
                    </div>
                `);
            marker.storeId = store.id;
            this.markers.push(marker);
        });
    }

    focusStore(store) {
        this.currentMap.setView([store.lat, store.lng], 15);
        const marker = this.markers.find(m => m.storeId == store.id);
        if (marker) marker.openPopup();
    }
}

// ======================================================
// 3. CONTROLADOR (Gestión de Eventos)
// ======================================================
class SedesController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
    }

    async init() {
        this.view.renderLocationsTags(this.model.mapLocations, (city) => {
            document.getElementById("locationInput").value = city;
            this.performSearch();
        });

        this.setupEventListeners();
        
        try {
            const sedes = await this.model.fetchSedes();
            this.view.initMap();
            this.view.renderStoresList(sedes);
            this.view.updateMarkers(sedes);
        } catch (error) {
            console.error("❌ ERROR:", error);
            document.getElementById("storesList").innerHTML = `<div style="color:red; padding:20px;">Error cargando sedes del servidor</div>`;
        }
    }

    performSearch() {
        const searchTerm = document.getElementById("locationInput").value;
        const filtered = this.model.filterStores(searchTerm);
        this.view.renderStoresList(filtered);
        this.view.updateMarkers(filtered);

        if (filtered.length > 0) {
            this.view.currentMap.setView([filtered[0].lat, filtered[0].lng], 11);
        }
    }

    centrarEnTienda(storeId) {
        const store = this.model.storesDatabase.find(s => s.id == storeId);
        if (store) this.view.focusStore(store);
    }

    setupEventListeners() {
        const btn = document.getElementById("searchLocationBtn");
        if (btn) btn.addEventListener("click", () => this.performSearch());

        const input = document.getElementById("locationInput");
        if (input) {
            input.addEventListener("keyup", (e) => {
                if (e.key === "Enter") this.performSearch();
            });
        }
    }
}

// Inicialización global segura
window.appSedes = new SedesController(new SedesModel(), new SedesView());
document.addEventListener("DOMContentLoaded", () => window.appSedes.init());