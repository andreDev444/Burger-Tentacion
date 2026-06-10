const express = require("express");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 1. Configuración de conexión
const config = {
    connectionString: "Driver={ODBC Driver 17 for SQL Server};Server=(localdb)\\MSSQLLocalDB;database=BurgerTentacion;Trusted_Connection=yes;"
};

// Conexión inicial
sql.connect(config).then(() => {
    console.log("✅ DB Burger Tentación Conectada y LISTA");
}).catch(err => {
    console.error("❌ Error de conexión inicial:", err.message);
});

// =========================================================================
// --- RUTAS de PQRSD (ESTAS NO SE TOCARON, TAL CUAL LAS TENÍAS) ---
// =========================================================================

app.get("/pqrsd", async (req, res) => {
    try {
        const result = await sql.query`SELECT * FROM pqrsd ORDER BY fecha_creacion DESC`;
        res.json(result.recordset);
    } catch (err) {
        console.error("Error en GET /pqrsd:", err.message);
        res.status(500).json({ error: "Error al obtener datos" });
    }
});

app.post("/pqrsd", async (req, res) => {
    try {
        const { nombre, correo, telefono, tipo, asunto, mensaje } = req.body;
        await sql.query`
            INSERT INTO pqrsd (nombre_completo, correo, telefono, tipo, asunto, mensaje)
            VALUES (${nombre}, ${correo}, ${telefono}, ${tipo}, ${asunto}, ${mensaje})
        `;
        res.status(200).send("OK");
    } catch (error) {
        console.error("Error en POST:", error);
        res.status(500).send(error.message);
    }
});

app.delete("/pqrsd/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await sql.query`DELETE FROM pqrsd WHERE id_pqrsd = ${id}`;
        res.status(200).send("Eliminado");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.put("/pqrsd/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { respuesta } = req.body;
        await sql.query`
            UPDATE pqrsd 
            SET respuesta_admin = ${respuesta}, estado = 'Respondido' 
            WHERE id_pqrsd = ${id}`;
        res.status(200).send("Actualizado");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// =========================================================================
// --- OTRAS RUTAS sedes) ---
// =========================================================================

app.get("/sedes", async (req, res) => {
    try {
        const result = await sql.query("SELECT * FROM sedes");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
// =========================================================================
// --- OTRAS RUTAS   PRODUCTOS) ---
// =========================================================================

app.get('/productos', async (req, res) => {
    try {
        const result = await sql.query("SELECT * FROM productos WHERE disponible = 1");
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/ordenar', async (req, res) => {
    // Ya estás desestructurando 'id_sede' y 'notas' del cuerpo de la petición, ¡perfecto!
    const { cliente, total, metodo_pago, productos, id_sede, notas } = req.body;
    
    try {
        // ==========================================
        // 1. INSERTAR USUARIO
        // ==========================================
        const requestUsuario = new sql.Request();
        let userResult = await requestUsuario
            .input('nombre', sql.VarChar, cliente.nombre)
            .input('tel', sql.VarChar, cliente.telefono)
            .input('dir', sql.VarChar, cliente.direccion)
            .query("INSERT INTO usuarios (nombre, telefono, direccion_entrega) OUTPUT INSERTED.id_usuario VALUES (@nombre, @tel, @dir)");
        
        const id_usuario = userResult.recordset[0].id_usuario;

        // ==========================================
        // 2. INSERTAR PEDIDO (Dinámico con GPS y Notas)
        // ==========================================
        const requestPedido = new sql.Request();
        let pedidoResult = await requestPedido
            .input('u', sql.Int, id_usuario)
            .input('s', sql.Int, id_sede)        // <-- Ahora usa el id_sede real calculado por el frontend
            .input('m', sql.VarChar, metodo_pago)
            .input('t', sql.Decimal(10, 2), total)
            .input('obs', sql.VarChar, notas)     // <-- Mapeamos el string de observaciones enviado
            .query(`
                INSERT INTO pedidos (id_usuario, id_sede, metodo_pago, total, observaciones) 
                OUTPUT INSERTED.id_pedido 
                VALUES (@u, @s, @m, @t, @obs)
            `);

        const id_pedido = pedidoResult.recordset[0].id_pedido;

        // ==========================================
        // 3. INSERTAR DETALLES
        // ==========================================
        for (let prod of productos) {
            await new sql.Request() // Nueva instancia de request por cada producto del bucle
                .input('p_id', sql.Int, id_pedido)
                .input('prod_id', sql.Int, prod.id_producto)
                .input('pre', sql.Decimal(10, 2), prod.precio_unitario)
                // Nota: Cantidad quemada en 1 y subtotal igual al precio unitario según tu lógica original
                .query("INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, subtotal) VALUES (@p_id, @prod_id, 1, @pre, @pre)");
        }

        // Enviamos éxito al cliente
        res.json({ success: true });

    } catch (err) { 
        console.error("❌ Error al procesar la orden:", err);
        res.status(500).json({ success: false, message: err.message }); 
    }
});
// =========================================================================
// --- INICIO DEL SERVIDOR (LO MÁS IMPORTANTE) ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log("=====================================");
    console.log(`🚀 SERVIDOR ESCUCHANDO EN EL PUERTO ${PORT}`);
    console.log(" =====================================");
});