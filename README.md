# Fichamundi - Sistema de Diseño y Cálculo de Naves y Buques

**Fichamundi** es una herramienta web interactiva orientada al diseño, personalización y cálculo de especificaciones técnicas para buques y submarinos. La aplicación permite seleccionar un casco base e integrar múltiples módulos de equipamiento (como armamento, sistemas de propulsión, blindaje, sensores y componentes internos), calculando dinámicamente las estadísticas finales de la nave.



## Propósito del Proyecto

El objetivo principal es proporcionar una interfaz clara y funcional para configurar vehículos navales de manera modular. A través de este sistema se busca:

1. **Automatizar el cálculo de métricas:** Calcular al instante variables fundamentales como el desplazamiento total, consumo energético, peso acumulado, requerimientos de espacio e impacto en las prestaciones de la nave a medida que se agregan o retiran componentes.
2. **Garantizar consistencia en los datos:** Estructurar las especificaciones de cascos y módulos en archivos independientes para evitar la duplicación de atributos y asegurar una gestión precisa de las variantes de equipamiento.
3. **Facilitar la expansión de contenido:** Permitir la incorporación de nuevas estructuras o módulos modificando únicamente los archivos de datos sin necesidad de reescribir la lógica del sistema.



## Arquitectura y Componentes del Sistema

El proyecto está construido sin dependencias externas pesadas, utilizando tecnologías web estándar y un enfoque orientado a datos.

## Plantillas comunitarias con Supabase

[`pages/plantillas.html`](./pages/plantillas.html) permite enviar archivos JSON sin iniciar sesión y consultar públicamente todas las plantillas —pendientes, aprobadas y desaprobadas— con una etiqueta de estado y filtros por país y estado. Los comentarios también son públicos. El acceso de moderadores permanece oculto hasta pulsar «Acceso para moderadores»; en cada plantilla pendiente aparecen los controles para aprobarla o desaprobarla y añadir comentarios.

La configuración del cliente está en [`js/supabase-config.js`](./js/supabase-config.js). `SUPABASE_URL` debe ser solo la URL base del proyecto (por ejemplo, `https://<project-ref>.supabase.co`, sin `/rest/v1`), y `SUPABASE_ANON_KEY` debe contener la clave pública `anon` o `publishable`. No pongas claves `service_role` o `secret` en el navegador.

Los usuarios normales solo suben JSON y no crean cuentas. El acceso de moderador pide una clave compartida; no hay registro de cuentas, Edge Function ni consulta de autenticación al abrir la página. La clave se valida en Supabase al enviarla y vuelve a validarse para cada acción de moderación. Si todavía no aplicaste las migraciones, ejecútalas en SQL Editor en este orden: [`supabase/migrations/20261019_public_template_queue.sql`](./supabase/migrations/20261019_public_template_queue.sql), [`supabase/migrations/20261019_moderator_key_rpc.sql`](./supabase/migrations/20261019_moderator_key_rpc.sql), [`supabase/migrations/20261019_template_review_comments.sql`](./supabase/migrations/20261019_template_review_comments.sql) y [`supabase/migrations/20261019_moderator_access_confirmation.sql`](./supabase/migrations/20261019_moderator_access_confirmation.sql). Si las tres primeras ya están aplicadas, ejecuta solo la última. Luego configura la clave directamente en Supabase:

```sql
insert into private.moderator_settings (setting_id, moderator_key)
values (true, 'REEMPLAZA_POR_UNA_CLAVE_PRIVADA_DE_32_O_MAS_CARACTERES')
on conflict (setting_id)
do update set moderator_key = excluded.moderator_key, updated_at = now();
```

La clave no se guarda en los archivos del sitio. El formulario solo muestra los controles; Supabase valida la clave dentro de funciones SQL cada vez que se solicita cambiar el estado o publicar un comentario. No hay consulta de verificación al mostrar la página. Las funciones no permiten editar el JSON ni borrar plantillas, y las tablas privadas no son accesibles directamente desde el navegador. Usa una clave larga y privada; la clave que se compartió en el chat debe considerarse expuesta y cambiarse.

Si ya ejecutaste la migración de cola pública, no necesitas repetirla; aplica la migración de clave después para dejar las acciones de moderación restringidas a las funciones SQL.
