# Histórico de Odontogramas mediante Snapshot

Este documento describe el flujo completo de guardado y recuperación de versiones históricas del odontograma utilizando la nueva tabla `OdontogramaVersionSnapshot`.

## Objetivo
Garantizar que cada versión del odontograma almacene un estado **completo y reproducible** (todas las áreas pintadas, códigos con colores, prótesis, coronas, diastemas, aparatos, elementos especiales, etc.) sin depender de reconstrucciones parciales dispersas.

## Componentes Clave
- Tabla SQL: `OdontogramaVersionSnapshot (OdontogramaVersionId UNIQUE, Data NVARCHAR(MAX))`.
- Endpoints:
  - `POST /api/version/:versionId/snapshot` (upsert del JSON completo).
  - `GET  /api/version/:versionId/snapshot` (obtención y parseo del JSON).
- Frontend (`Odontograma.tsx`):
  - Función `ejecutarGuardado()` genera el objeto snapshot y lo envía tras crear nuevo odontograma + versión.
  - Función `loadHistoricoOdontograma(correlativo)` rehidrata estado a partir del snapshot de la última versión encontrada.

## Flujo de Guardado
1. Usuario confirma guardado (modal verde).
2. Se crea SIEMPRE un nuevo registro en `Odontograma` y su versión inicial (v1) si corresponde.
3. Se persisten individualmente (best-effort) algunos elementos todavía en tablas base (áreas, códigos, diastemas, etc.).
4. Se arma `snapshot` con:
   ```ts
   {
     meta: { accountNumber, savedAt, patientName },
     teethStatus,
     teethCodes,
     prostheses,
     crowns,
     appliances,
     removableAppliances,
     diastemas,
     supernumerarias,
     fullProstheses,
     partialRemovables,
     tempRestorations,
     transpositions,
     edentulos,
     espigos,
     fracturas,
     fusiones,
     geminaciones,
     giroversions,
     clavijas,
     erupciones,
     extruidas,
     intrusiones
   }
   ```
5. Se envía el objeto al endpoint `/api/version/{versionId}/snapshot`.
6. Se actualiza el histórico sin recargar toda la página.

## Flujo de Rehidratación
1. Usuario selecciona un correlativo desde el histórico.
2. Se obtiene el odontograma y su lista de versiones (`/odontograma/historico/:nroCuenta/:correlativo`).
3. Se identifica la última versión (orden descendente) y se pide el snapshot.
4. Si existe snapshot:
   - Se setean TODOS los estados React directamente desde el JSON.
5. Si no existe snapshot:
   - Se muestra mensaje informativo y se podrían usar endpoints parciales como fallback (opcional futuro).

## Beneficios
- Integridad: Un único JSON asegura que futuras extensiones (nuevos elementos gráficos) sólo requieren añadir propiedades al snapshot.
- Simplicidad: Rehidratación rápida con una llamada.
- Evolutivo: Permite migrar a esquema puramente basado en snapshots si se desea.

## Posibles Mejoras Futuras
- Hash de integridad (campo `Hash`) calculado al guardar para verificar corrupción.
- Versionado incremental de schema del snapshot (`meta.schemaVersion`).
- Endpoint para listar snapshots históricos más livianos (sin tablas base).
- Eliminación gradual de persistencias redundantes (áreas/códigos) una vez validado el snapshot como fuente única.

## Recuperación de Versiones Anteriores
Para mostrar versiones específicas distintas de la última, se puede extender el selector para pedir `GET /api/version/:versionId/snapshot` de la versión elegida en lugar de usar sólo la más reciente.

## Fallback (Si falta Snapshot)
- Mostrar alerta "No existe snapshot para esta versión".
- Opción de reconstrucción tentativa haciendo múltiples llamadas (actual implementación ya conserva endpoints base).

## Consideraciones de Rendimiento
- Tamaño del JSON dependerá del número de elementos gráficos (normalmente pequeño).
- NVARCHAR(MAX) en SQL Server 2012: suficiente para cientos de KB (muy por encima del tamaño típico del odontograma).

## Estado Actual
- Tabla y endpoints operativos.
- Guardado y rehidratación implementados.
- Reload completo desactivado para experiencia más fluida.

## Próximo Paso
- Validar en entorno real con varios guardados; confirmar que el snapshot refleja cada cambio visible.
- Ajustar UI para permitir explorar versiones anteriores (no solo última) si se requiere.

---
Documentación preparada para soporte y mantenimiento del histórico por snapshot.
