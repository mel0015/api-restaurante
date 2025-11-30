const express = require('express');
const cors = require('cors');
const connection = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = "holaplebes"; 

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//registro
app.post('/usuarios/register', async (req, res) => {
  const { nombre, telefono, contrasena } = req.body;
  if (!nombre || !telefono || !contrasena)
    return res.status(400).json({ mensaje: "Faltan campos" });

  const hash = await bcrypt.hash(contrasena, 10);
  const sql = "INSERT INTO usuarios (nombre, telefono, contraseña) VALUES (?, ?, ?)";
  connection.query(sql, [nombre, telefono, hash], (err, result) => {
    if (err) return res.status(500).json({ mensaje: "Error al registrar usuario", error: err });
    res.status(201).json({ mensaje: "Usuario registrado", id: result.insertId });
  });
});


//login
app.post('/usuarios/login', (req, res) => {
  const { telefono, contrasena } = req.body;
  if (!telefono || !contrasena)
    return res.status(400).json({ mensaje: "Faltan campos" });

  connection.query("SELECT * FROM usuarios WHERE telefono = ?", [telefono], async (err, results) => {
    if (err) return res.status(500).json({ mensaje: "Error al buscar usuario", error: err });
    if (results.length === 0) return res.status(404).json({ mensaje: "Usuario no encontrado" });

    const usuario = results[0];
    const match = await bcrypt.compare(contrasena, usuario.contraseña);
    if (!match) return res.status(401).json({ mensaje: "Contraseña incorrecta" });

    const token = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: "2h" });
    res.status(200).json({ mensaje: "Login exitoso", token });
  });
});

//middleware
function autenticar(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ mensaje: "Token requerido" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ mensaje: "Token inválido" });
    req.usuarioId = decoded.id;
    next();
  });
}

app.post('/reservaciones', autenticar, (req, res) => {
  const { nombre, personas, mensaje, telefono, fecha, hora } = req.body;

  // Validación
  if (!nombre || !personas || !fecha || !hora)
    return res.status(400).json({ mensaje: "Faltan campos obligatorios" });

  // Insertar contacto
  const sqlContacto = `INSERT INTO contactos (telefono) VALUES (?)`;
  connection.query(sqlContacto, [telefono || null], (err, resultContacto) => {
    if (err) return res.status(500).json({ mensaje: "Error al insertar contacto", error: err });

    const contacto_id = resultContacto.insertId;

    const sqlFecha = `INSERT INTO fechas_reservacion (fecha) VALUES (?)`;
    connection.query(sqlFecha, [fecha], (err, resultFecha) => {
      if (err) return res.status(500).json({ mensaje: "Error al insertar fecha", error: err });

      const fecha_id = resultFecha.insertId;
      const sqlReservacion = `
        INSERT INTO reservaciones (usuario_id, nombre, personas, mensaje, contacto_id, fecha_id, hora)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      connection.query(
        sqlReservacion,
        [req.usuarioId, nombre, personas, mensaje || null, contacto_id, fecha_id, hora],
        (err, resultReservacion) => {

          if (err) return res.status(500).json({ mensaje: "Error al insertar reservación", error: err });

          res.status(201).json({
            mensaje: "Reservación guardada",
            reservacion: {
              id: resultReservacion.insertId,
              nombre,
              personas,
              mensaje: mensaje || null,
              contacto: { telefono: telefono || null },
              fecha,
              hora
            }
          });
        }
      );
    });
  });
});


app.get('/reservaciones', (req, res) => {
  const sql = `
    SELECT r.id, r.nombre, r.personas, r.mensaje,
           c.telefono, f.fecha,r.hora, u.nombre AS usuario
    FROM reservaciones r
    LEFT JOIN contactos c ON r.contacto_id = c.id
    LEFT JOIN fechas_reservacion f ON r.fecha_id = f.id
    LEFT JOIN usuarios u ON r.usuario_id = u.id
    ORDER BY r.id DESC
  `;

  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ mensaje: "Error al obtener reservaciones", error: err });
    const data = results.map(r => ({
     id: r.id,
     nombre: r.nombre,
     personas: r.personas,
     mensaje: r.mensaje,
     contacto: { telefono: r.telefono },
     fecha: r.fecha,
     hora: r.hora,   
     usuario: r.usuario
   }));
    res.status(200).json(data);
  });
});


app.post('/opiniones', autenticar, (req, res) => {
  const { calificacion, comentario } = req.body;

  if (!calificacion) 
    return res.status(400).json({ mensaje: "Calificacion obligatoria" });
  if (calificacion < 1 || calificacion > 5) 
    return res.status(400).json({ mensaje: "Calificación debe ser entre 1 y 5" });

  const sqlUsuario = "SELECT nombre FROM usuarios WHERE id = ?";
  connection.query(sqlUsuario, [req.usuarioId], (err, resultUser) => {
    if (err) 
      return res.status(500).json({ mensaje: "Error obteniendo usuario", error: err });

    if (resultUser.length === 0)
      return res.status(404).json({ mensaje: "Usuario no encontrado" });

    const nombreUsuario = resultUser[0].nombre;
  
  
  const sql = `
    INSERT INTO opiniones (usuario_id, nombre, calificacion, comentario)
    VALUES (?, ?, ?, ?)
  `;

  connection.query(sql, [req.usuarioId, nombreUsuario, calificacion, comentario || null], (err, result) => {
    if (err) 
      return res.status(500).json({ mensaje: "Error al guardar opinión", error: err });

    res.status(201).json({
      mensaje: "Opinión guardada",
      opinion: {
        id: result.insertId,
        usuario_id: req.usuarioId,
        nombre: nombreUsuario,
        calificacion,
        comentario: comentario || null
      }
    });
    }
   );
  });
});

//all
app.get('/opiniones', (req, res) => {
  const sql = `
    SELECT o.id, o.nombre, o.calificacion, o.comentario, o.fecha, u.nombre AS usuario
    FROM opiniones o
    LEFT JOIN usuarios u ON o.usuario_id = u.id
    ORDER BY o.id DESC
  `;
  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ mensaje: "Error al obtener opiniones", error: err });
    const data = results.map(o => ({
      id: o.id,
      nombre: o.nombre,
      calificacion: o.calificacion,
      comentario: o.comentario,
      fecha: o.fecha,
      usuario: o.usuario
    }));
    res.status(200).json(data);
  });
});


app.listen(PORT, () => {
  console.log(`Servidor ejecutando en http://localhost:${PORT}`);
});
