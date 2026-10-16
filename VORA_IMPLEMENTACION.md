# VORA — Primera entrega: identidad y catálogo modular

## Incluido
- Paleta base verde VORA para el diseño global. Se preserva la personalización por empresa y el caso SOLEÉ.
- Metadatos públicos de VORA by Venesoft.
- Seis módulos futuros en el catálogo: Billing, Store, Network, Bank, Pay y Fiscal.
- Migración SQL aditiva: no activa módulos para ninguna empresa.
- Los endpoints de activación rechazan módulos `planned` (HTTP 409).
- Siigo y Shopify permanecen sin modificar.

## Importante
Los módulos nuevos **NO** implementan todavía pantallas funcionales, APIs bancarias, facturación fiscal ni tiendas públicas. No se deben comercializar como operativos. La paleta actual de empresas ya configuradas puede prevalecer sobre los colores VORA.

## Aplicación
1. Crear una rama `feature/vora-core-catalog`.
2. Aplicar el parche o copiar los archivos actualizados.
3. Revisar la migración `20261016000000_vora_optional_modules.sql` y ejecutarla en Supabase primero en pruebas.
4. Ejecutar `npm ci`, `npm run typecheck` y `npm run build`.
5. Verificar superadmin, SOLEÉ, tenant genérico y activación/desactivación de módulos.
6. Hacer commit y abrir Pull Request. Nunca subir archivos `.env`.

## Pendiente
- Diseño y páginas de cada módulo nuevo.
- Auditoría de autorizaciones de lectura de endpoints (incluyendo GET de módulos).
- Comprobación integral de CRUD, aislamiento multitenant y aprovisionamiento.
- Revisión visual con capturas del entorno ejecutado.
