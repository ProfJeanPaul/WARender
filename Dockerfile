# Usa una imagen base de Node.js que ya incluye algunas herramientas de compilación
# y es adecuada para Puppeteer. La versión slim es más ligera.
FROM node:22-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Instala las dependencias del sistema operativo necesarias para Chromium
# Estas son las librerías comunes que Puppeteer necesita para funcionar en entornos headless de Linux.
# El comando apt update y apt install funcionan aquí porque es un entorno de Docker con permisos de escritura.
RUN apt update && apt install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libxkbcommon0 \
    libxdamage1 \
    libxcomposite1 \
    libxrandr2 \
    libgbm-dev \
    libasound2 \
    # Dependencias adicionales que a veces son útiles para Puppeteer
    fonts-liberation \
    gconf-service \
    libappindicator1 \
    libasound2 \
    libgconf-2-4 \
    libnspr4 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    # Limpia la caché de apt para reducir el tamaño de la imagen
    && apt clean \
    && rm -rf /var/lib/apt/lists/*

# Copia los archivos de definición de dependencias y el script de instalación
COPY package.json package-lock.json* ./

# Instala las dependencias de Node.js
# El script postinstall de Puppeteer se ejecutará aquí para descargar Chromium
RUN npm install

# Copia el resto de los archivos de tu aplicación
COPY . .

# Expone el puerto en el que tu aplicación Express escuchará
EXPOSE 3000

# Comando para iniciar tu aplicación cuando el contenedor se ejecute
CMD ["npm", "start"]
