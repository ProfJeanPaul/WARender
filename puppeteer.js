// whatsapp_puppeteer_script.js
// Script de Node.js para automatizar WhatsApp Web usando Puppeteer.

const puppeteer = require('puppeteer'); // Importa la librería Puppeteer

/**
 * Función principal para automatizar el envío de mensajes en WhatsApp Web.
 * @param {string} contactName - El nombre del contacto al que se enviará el mensaje.
 * @param {string[]} messages - Un array de strings, donde cada string es un mensaje a enviar.
 * @param {number} initialDelay - Retardo en milisegundos antes de iniciar la automatización.
 * @param {number} messageGap - Retardo en milisegundos entre el envío de cada mensaje (si hay varios).
 * @param {string} sendOption - Opción de envío: "single_and_close" o "multiple_and_close".
 */
async function automateWhatsApp(contactName, messages, initialDelay, messageGap, sendOption) {
    let browser; // Declara la variable browser fuera del try para asegurar que esté disponible en finally
    try {
        console.log('Iniciando navegador Chromium...');
        browser = await puppeteer.launch({
            headless: true, // ¡IMPORTANTE! Cambiado a true para el despliegue en servidor (Render)
            userDataDir: './whatsapp_data', // Persiste la sesión para no escanear QR cada vez
            args: [
                '--no-sandbox', // Necesario para entornos de servidor (ej. Docker, Render)
                '--disable-setuid-sandbox',
                // Argumentos adicionales para entornos sin interfaz gráfica
                '--disable-gpu',
                '--disable-dev-shm-usage', // Reduce el uso de /dev/shm, útil en contenedores
                '--no-zygote',
                '--single-process', // Puede ayudar en algunos entornos
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-client-side-phishing-detection',
                '--disable-sync',
                '--disable-features=site-per-process', // Puede ayudar con el rendimiento
                '--disable-web-security', // Usar con precaución, pero a veces necesario en headless
                '--disable-features=IsolateOrigins,site-per-process',
                '--blink-settings=imagesEnabled=false' // Deshabilitar imágenes para reducir carga
            ],
            // ¡IMPORTANTE! Comentamos executablePath. Dejamos que Puppeteer lo encuentre automáticamente.
            // La instalación a través de "postinstall": "npx puppeteer browsers install chrome"
            // debería colocarlo en una ubicación detectable por Puppeteer.
            // executablePath: '/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome'
            // dumpio: true // Esto es CRUCIAL para ver los logs internos del navegador en Render
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 }); // Establece un tamaño de ventana para consistencia

        // Aplicar el retardo inicial si se especifica
        if (initialDelay && initialDelay > 0) {
            console.log(`Aplicando retardo inicial de ${initialDelay / 1000} segundos...`);
            await new Promise(resolve => setTimeout(resolve, initialDelay));
        }

        console.log('Navegando a WhatsApp Web...');
        // Aumentar el timeout para la navegación inicial
        await page.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle2', timeout: 90000 }); // Aumentado a 90 segundos
        console.log('Navegación a WhatsApp Web completada.');


        console.log('Esperando a que WhatsApp Web esté listo (escaneo de QR si es necesario)...');
        // Selectores alternativos para verificar que WhatsApp Web ha cargado y el usuario ha iniciado sesión.
        // Aumentar el timeout total para esta espera
        const whatsappReadySelectors = [
            'div[aria-label="Lista de chats"][role="grid"]', // Selector original de la lista de chats
            'div[data-testid="chat-list"]', // Test ID común para la lista de chats
            'span[data-testid="chat-list-header-text"]', // Texto como "Chats" en el encabezado
            'div[aria-label="Barra lateral de chats"]', // Etiqueta aria de la barra lateral
            'div[aria-label="Lista de chats"]', // Versión más simple del selector original
            'div[role="textbox"][aria-placeholder="Buscar"]', // El campo de búsqueda principal, visible cuando los chats están cargados
            'canvas[aria-label="Scan me!"]', // Si se queda en la pantalla del QR
            'div[data-testid="qr-code-image"]' // Otro selector para el QR
        ];

        let foundReadySelector = null;
        const overallReadyTimeout = 120000; // Aumentado a 120 segundos (2 minutos)
        const checkInterval = 2000; // Revisar cada 2 segundos
        const startTime = Date.now();

        while (Date.now() - startTime < overallReadyTimeout) {
            for (const selector of whatsappReadySelectors) {
                try {
                    // Usamos page.waitForSelector con un timeout muy corto (o checkear directamente)
                    // para no bloquear el bucle si un selector no está presente.
                    const element = await page.waitForSelector(selector, { visible: true, timeout: 1000 }); // Timeout corto por selector
                    if (element) {
                        foundReadySelector = selector;
                        console.log(`WhatsApp Web listo. Selector encontrado: ${foundReadySelector}`);
                        break; // Salir del bucle de selectores
                    }
                } catch (e) {
                    // console.log(`Selector de preparación "${selector}" no encontrado, intentando el siguiente...`); // Comentado para reducir logs excesivos
                }
            }
            if (foundReadySelector) {
                break; // Salir del bucle principal si se encontró un selector
            }
            await new Promise(resolve => setTimeout(resolve, checkInterval)); // Esperar antes de reintentar
        }

        if (!foundReadySelector) {
            throw new puppeteer.errors.TimeoutError(`Tiempo de espera agotado (${overallReadyTimeout / 1000}s): WhatsApp Web no se cargó o no se pudo iniciar sesión con ninguno de los selectores de preparación.`);
        }

        // Si se encontró el QR, significa que la sesión no está activa.
        if (foundReadySelector === 'canvas[aria-label="Scan me!"]' || foundReadySelector === 'div[data-testid="qr-code-image"]') {
             console.error('WhatsApp Web está mostrando la pantalla de código QR. La sesión no está activa o ha expirado.');
             throw new Error('Sesión de WhatsApp expirada o no iniciada. Por favor, inicia sesión localmente y sube el directorio whatsapp_data actualizado.');
        }

        console.log('WhatsApp Web listo para interacción.');

        // 1. Hacer clic en el campo de búsqueda principal (global)
        console.log('Buscando y haciendo clic en el campo de búsqueda principal...');
        // Selectores alternativos para el campo de búsqueda global en la interfaz de WhatsApp Web
        const globalSearchInputSelectors = [
            '[data-testid="search-input"]', // Selector más común y estable
            'div[aria-placeholder="Buscar"][role="textbox"]', // Selector anterior
            'div[role="textbox"][title="Buscar"]', // Otro selector basado en el título
            'div[contenteditable="true"][data-tab="3"]' // Un selector de fallback
        ];

        let foundSearchSelector = null;
        for (const selector of globalSearchInputSelectors) {
            try {
                // Usamos page.waitForSelector con un timeout corto para encontrar el primero que exista
                await page.waitForSelector(selector, { visible: true, timeout: 3000 });
                foundSearchSelector = selector;
                console.log(`Campo de búsqueda encontrado con selector: ${foundSearchSelector}`);
                break; // Salir del bucle una vez que se encuentra un selector
            } catch (e) {
                console.log(`Selector "${selector}" no encontrado, intentando el siguiente...`);
            }
        }

        if (!foundSearchSelector) {
            throw new Error('No se pudo encontrar el campo de búsqueda principal de WhatsApp Web con ninguno de los selectores.');
        }

        await page.click(foundSearchSelector);
        console.log('Campo de búsqueda principal clicado.');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Pequeño retardo para asegurar el enfoque

        // NEW: Buscar el campo de entrada de texto real para escribir después del clic
        console.log('Buscando el campo de entrada de texto para escribir el nombre del contacto...');
        const activeSearchInputSelectors = [
            'div[contenteditable="true"][data-tab="3"]', // Este fue un fallback para el clic inicial, podría ser el activo
            '[data-testid="chat-list-search"]', // Común para la búsqueda activa
            'input[type="text"][aria-label="Buscar"]', // Otro patrón común para la búsqueda activa
            'div[role="textbox"][title="Buscar mensaje o contacto"]', // Específico para la búsqueda activa
            'div[role="textbox"][aria-label="Buscar o iniciar un nuevo chat"]' // Otro patrón común
        ];

        let activeSearchInputForTyping = null;
        for (const selector of activeSearchInputSelectors) {
            try {
                await page.waitForSelector(selector, { visible: true, timeout: 3000 });
                activeSearchInputForTyping = selector;
                console.log(`Campo de entrada de texto encontrado con selector: ${activeSearchInputForTyping}`);
                break;
            } catch (e) {
                console.log(`Selector de entrada activa "${selector}" no encontrado, intentando el siguiente...`);
            }
        }

        if (!activeSearchInputForTyping) {
            throw new Error('No se pudo encontrar el campo de entrada de texto activo para escribir el nombre del contacto.');
        }

        // 2. Escribir el nombre del contacto en el campo de búsqueda principal (ahora el activo)
        console.log(`Escribiendo "${contactName}" en el campo de búsqueda principal...`);
        // Usar el selector del campo de búsqueda activo recién encontrado para escribir
        await page.type(activeSearchInputForTyping, contactName, { delay: 50 }); // Simula escritura humanizada con delay
        console.log('Nombre de contacto escrito en el campo de búsqueda principal.');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Espera a que los resultados de búsqueda aparezcan

        // 3. Simular la pulsación de Enter para seleccionar el primer resultado (o abrir el chat)
        console.log('Simulando la pulsación de Enter para abrir el chat...');
        await page.keyboard.press('Enter');
        console.log('Enter simulado.');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Espera a que el chat se abra completamente

        // 4. Esperar a que el cuadro de texto del mensaje (compose-box) esté disponible
        console.log('Esperando el cuadro de texto del mensaje (compose-box)...');
        // Selector para el cuadro de texto de entrada de mensaje en la conversación
        const messageTextboxSelector = 'div[role="textbox"][aria-placeholder="Escribe un mensaje"][data-lexical-editor="true"]';
        await page.waitForSelector(messageTextboxSelector, { visible: true, timeout: 10000 });
        console.log('Cuadro de texto del mensaje (compose-box) encontrado.');

        // Bucle para enviar múltiples mensajes
        for (let i = 0; i < messages.length; i++) {
            const currentMessage = messages[i];
            console.log(`Escribiendo el mensaje ${i + 1}/${messages.length}: "${currentMessage}"`);
            await page.type(messageTextboxSelector, currentMessage, { delay: 50 }); // Simula escritura humanizada
            console.log('Mensaje escrito.');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Pequeño retardo antes de enviar

            console.log('Enviando el mensaje...');
            await page.keyboard.press('Enter');
            console.log('Mensaje enviado.');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Espera a que el mensaje se envíe y el cuadro de texto se limpie

            // Aplicar el gap entre mensajes si no es el último y la opción lo permite
            if (sendOption === "multiple_and_close" && i < messages.length - 1 && messageGap > 0) {
                console.log(`Aplicando gap de ${messageGap / 1000} segundos antes del siguiente mensaje...`);
                await new Promise(resolve => setTimeout(resolve, messageGap));
            }
        }

        console.log('Automatización completada con éxito.');

    } catch (error) {
        console.error('Error durante la automatización de WhatsApp:', error);
        throw error; // Re-lanza el error para que el servidor lo capture
    } finally {
        if (browser) {
            await browser.close(); // Esta línea ahora cerrará el navegador automáticamente
            console.log('Navegador cerrado.');
        }
    }
}

// Exporta la función para que pueda ser importada por server.js
module.exports = automateWhatsApp;

// NOTA: La sección de "Uso del script" local ha sido eliminada
// ya que esta función será llamada por el servidor.
