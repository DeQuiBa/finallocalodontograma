# Odontograma

Aplicación web para registrar, editar, guardar y consultar odontogramas con histórico de versiones.

El proyecto está dividido en dos partes:

- `odontograma-app/`: frontend en React + TypeScript + Vite.
- `server/`: backend en Node.js + Express + SQL Server.

## Vista general

El flujo general es este:

1. El frontend muestra el odontograma y permite marcar piezas, áreas, prótesis, eventos clínicos y observaciones.
2. El backend expone endpoints REST para guardar y recuperar la información.
3. La base de datos SQL Server almacena el odontograma principal, sus versiones y snapshots históricos.
4. El histórico se consulta por `Nro_Historia`, y cada registro se presenta con un correlativo visible como `00001`, `00002`, `00020`, etc.

## Requisitos

- Node.js 18 o superior
- npm 9 o superior
- SQL Server accesible desde el backend

## Estructura del proyecto

```text
odontograma/
├── odontograma-app/
│   ├── src/
│   ├── package.json
│   └── README.md
└── server/
    ├── server.js
    ├── package.json
    ├── tablas.sql
    ├── datos_prueba.sql
    └── limpieza.sql
```

## Base de datos

La aplicación usa SQL Server.

Archivos importantes:

- `server/tablas.sql`: crea o recrea la estructura principal de la base de datos.
- `server/datos_prueba.sql`: inserta datos de prueba y algunos catálogos básicos.
- `server/limpieza.sql`: bloque opcional de limpieza para desarrollo.

### Orden recomendado para cargar la base de datos

1. Crear o elegir una base de datos en SQL Server.
2. Ejecutar `server/tablas.sql`.
3. Ejecutar `server/datos_prueba.sql` si deseas datos de ejemplo.
4. Ejecutar `server/limpieza.sql` solo si necesitas reiniciar el esquema en desarrollo.

Importante:

- `tablas.sql` contiene sentencias `DROP` y recreación de tablas. No lo ejecutes sin respaldo en un entorno productivo.
- Al iniciar, el backend también intenta ajustar algunas columnas e índices automáticamente para mantener compatibilidad.

## Configuración del backend

El backend toma la configuración desde variables de entorno. El archivo esperado está en `server/.env`.

Variables soportadas:

```env
PORT=3088
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_PASS=tu_password
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=SIGH
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
PATIENTS_TABLE=
```

Notas:

- `DB_PASSWORD` y `DB_PASS` funcionan como alternativas.
- Si no defines estas variables, el backend usa valores por defecto pensados para desarrollo local.
- En servidor conviene definir todas explícitamente.

## Instalación local

### 1. Instalar dependencias del backend

Desde la carpeta `server/`:

```bash
npm install
```

### 2. Instalar dependencias del frontend

Desde la carpeta `odontograma-app/`:

```bash
npm install
```

## Ejecución local

### Levantar el backend

Desde `server/`:

```bash
npm run dev
```

Modo producción:

```bash
npm start
```

Por defecto el backend queda en:

```text
http://localhost:3088
```

La API queda en:

```text
http://localhost:3088/api
```

### Levantar el frontend

Desde `odontograma-app/`:

```bash
npm run dev
```

Por defecto el frontend queda en:

```text
http://localhost:5173
```

## Conexión entre frontend y backend

Actualmente el frontend usa una URL fija para la API en el archivo `src/components/Odontograma.tsx`:

```ts
const API_BASE = 'http://localhost:3088/api';
```

Esto significa que:

- En desarrollo local funciona si el backend corre en `localhost:3088`.
- En un servidor deberás cambiar esa URL antes de generar el build del frontend, para apuntar al dominio o IP real del backend.

Ejemplo:

```ts
const API_BASE = 'https://tu-dominio.com/api';
```

## Build para producción

Desde `odontograma-app/`:

```bash
npm run build
```

Esto genera la carpeta `dist/`, que contiene los archivos estáticos del frontend listos para publicar.

Para probar el build localmente:

```bash
npm run preview
```

## Despliegue en servidor

### Backend

Idea general:

1. Copiar la carpeta `server/` al servidor.
2. Crear el archivo `.env` con los datos reales de SQL Server.
3. Ejecutar `npm install`.
4. Levantar el backend con `npm start` o con un administrador de procesos como PM2.
5. Publicar el puerto `3088` o ponerlo detrás de Nginx/Apache.

Ejemplo con PM2:

```bash
npm install
pm2 start server.js --name odontograma-api
```

### Frontend

Idea general:

1. Cambiar `API_BASE` para que apunte a la URL real del backend.
2. Ejecutar `npm install`.
3. Ejecutar `npm run build`.
4. Publicar el contenido de `dist/` en Nginx, Apache o cualquier hosting estático.

## Flujo básico de uso

1. El usuario busca o valida una historia clínica.
2. Se habilita la edición del odontograma.
3. Se marcan piezas, áreas, prótesis y eventos clínicos.
4. El guardado crea registros y versiones en base de datos.
5. El histórico permite recuperar odontogramas anteriores por correlativo.
6. Parte del estado se guarda también como snapshot para rehidratación completa.

## Archivos importantes

- `server/server.js`: servidor Express y endpoints de la API.
- `server/tablas.sql`: estructura principal de la base de datos.
- `server/datos_prueba.sql`: datos semilla para pruebas.
- `server/limpieza.sql`: limpieza de tablas e índices en desarrollo.
- `src/components/Odontograma.tsx`: lógica principal del frontend.
- `SNAPSHOT-HISTORICO.md`: explicación del flujo de snapshots e histórico.

## Problemas comunes

### El backend no inicia

Revisar:

- que SQL Server esté accesible
- que la base exista
- que las credenciales del `.env` sean correctas
- que el puerto `1433` esté abierto si la base está en otra máquina

### El frontend abre, pero no guarda

Revisar:

- que el backend esté ejecutándose
- que `API_BASE` apunte a la URL correcta
- que el navegador no esté bloqueando solicitudes por una URL mal configurada

### El histórico no muestra datos

Revisar:

- que se haya ejecutado `tablas.sql`
- que existan registros para `Nro_Historia`
- que, si quieres datos de prueba, hayas ejecutado `datos_prueba.sql`

## Comandos rápidos

Backend:

```bash
cd server
npm install
npm run dev
```

Frontend:

```bash
cd odontograma-app
npm install
npm run dev
```

## Resumen para subirlo a un servidor

Si vas a publicarlo en un servidor, la idea general es esta:

1. Preparar SQL Server y ejecutar `tablas.sql`.
2. Cargar `datos_prueba.sql` solo si quieres datos semilla.
3. Configurar `server/.env` con credenciales reales.
4. Levantar el backend con Node.js.
5. Cambiar la URL `API_BASE` del frontend para apuntar al backend real.
6. Generar `dist/` con `npm run build`.
7. Publicar `dist/` en el servidor web.

Con esos pasos ya tendrás una base clara para entender cómo ejecutar, conectar y desplegar el proyecto.
