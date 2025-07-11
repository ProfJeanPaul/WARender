// server.js
// Servidor Node.js con Express para recibir solicitudes y ejecutar el script de Puppeteer.

const express = require('express');
const cors = require('cors');
const automateWhatsApp = require('./puppeteer.js'); // Importa la función de Puppeteer

const app = express();
const port = process.env.PORT || 3000; // Usa el puerto de Render o 3000 localmente

// Configuración de CORS
// Permite solicitudes desde cualquier origen. En un entorno de producción,
// deberías restringir esto a tu dominio específico del formulario HTML.
app.use(cors());

// Middleware para parsear el cuerpo de las solicitudes JSON
app.use(express.json());

// Ruta principal para verificar que el servidor está funcionando
app.get('/', (req, res) => {
    res.status(200).json({ message: 'WhatsApp Automator Server is running!' });
});

// Ruta para enviar mensajes de WhatsApp
app.post('/send-whatsapp-message', async (req, res) => {
    const { contactName, messageText, initialDelay, messageGap, sendOption } = req.body;

    // Validaciones básicas de los datos recibidos
    if (!contactName || !messageText || !sendOption) {
        return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos: contactName, messageText, sendOption.' });
    }

    let messages = [];
    if (Array.isArray(messageText)) {
        messages = messageText; // Si ya es un array, úsalo directamente
    } else if (typeof messageText === 'string') {
        // Si es una cadena, divídela por saltos de línea para obtener mensajes individuales
        messages = messageText.split('\n').filter(msg => msg.trim() !== '');
    } else {
        return res.status(400).json({ success: false, message: 'El formato de messageText no es válido. Debe ser una cadena o un array de cadenas.' });
    }

    if (messages.length === 0) {
        return res.status(400).json({ success: false, message: 'No se encontraron mensajes para enviar.' });
    }

    console.log(`Solicitud recibida para enviar mensaje a: ${contactName}`);
    console.log(`Mensajes a enviar: ${messages.length}`);
    console.log(`Retardo inicial: ${initialDelay || 0}ms`);
    console.log(`Gap entre mensajes: ${messageGap || 0}ms`);
    console.log(`Opción de envío: ${sendOption}`);

    try {
        // Llama a la función de automatización de Puppeteer
        await automateWhatsApp(contactName, messages, initialDelay, messageGap, sendOption);
        res.status(200).json({ success: true, message: 'Mensaje(s) enviado(s) con éxito.' });
    } catch (error) {
        console.error('Error al procesar la solicitud de WhatsApp:', error);
        res.status(500).json({ success: false, message: 'Error al enviar el mensaje(s) de WhatsApp.', error: error.message });
    }
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
