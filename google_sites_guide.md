# Guía Completa de Configuración en Google Sites (Versión Ampliada y WhatsApp)
## Portal Oficial de Audiencias - Juzgado Público Civil y Comercial N° 10

Esta guía actualizada explica cómo publicar la plataforma en **Google Sites** (`sites.google.com`) aprovechando la nueva escala **Full-Width (Tamaño Grande)**, el **Módulo de Gestión de Administradores** y el **Sistema de Notificaciones por WhatsApp**.

---

## 1. Solución al Tamaño en Google Sites (Visualización Grande)

Por defecto, cuando se inserta un bloque de código HTML en Google Sites, este se muestra en un recuadro pequeño. Para que se vea en **pantalla completa y con tamaño óptimo**:

1. Ingrese a **[Google Sites](https://sites.google.com)**.
2. Vaya a la página de su sitio (ej. `Agendar Audiencia`).
3. En el panel derecho, haga clic en **Insertar > Incorporar > Código HTML**.
4. Pegue todo el contenido del archivo [`google_sites_embed.html`](file:///c:/xampp/htdocs/aula-institucional/google_sites_embed.html).
5. **PASO CRÍTICO DE TAMAÑO**:
   - Una vez insertado el recuadro azul en la página de Google Sites, seleccione el recuadro.
   - **Ancho Horizontal**: Arrastre los círculos azules laterales hacia los extremos izquierdo y derecho de la pantalla hasta ocupar las **12 columnas** del lienzo de Google Sites.
   - **Alto Vertical**: Arrastre el círculo inferior hacia abajo hasta alcanzar una altura aproximada de **`1100px`** o más para evitar que aparezcan barras de desplazamiento internas.

---

## 2. Gestión de Administradores y Personal Judicial

El sitio incluye un sistema completo de roles para la Secretaría Judicial:

1. Vaya a la pestaña **Secretaría & Administradores**.
2. Haga clic en **"Iniciar Sesión de Administrador"**.
3. **Credenciales predeterminadas de demostración**:
   - **Juez Titular**: Usuario: `juez10` | Contraseña: `admin123`
   - **Secretaria de Cámara**: Usuario: `secretaria10` | Contraseña: `sec123`
   - **Auxiliar Judicial**: Usuario: `auxiliar10` | Contraseña: `aux123`
4. Al iniciar sesión, la Secretaría podrá:
   - Registrar nuevos funcionarios y asignarles cargos (*Juez, Secretario, Auxiliar, Conciliador/a*).
   - Dar por concluidas audiencias registradas.
   - Revocar accesos a usuarios administradores.

---

## 3. Notificaciones y Recordatorios por WhatsApp

El sistema cuenta con 2 mecanismos para WhatsApp sin costo:

1. **Al Agendar una Audiencia (Confirmación Inmediata)**:
   - Una vez agendada la causa, en el Paso 4 aparece el botón destacado en verde **"Enviar Confirmación por WhatsApp"**.
   - Al hacer clic, se abre WhatsApp Web/App con el mensaje judicial oficial pre-redactado conteniendo el número de NUREJ, tipo de audiencia, fecha, hora y sala.
2. **Recordatorios de 24 horas (Panel de Secretaría)**:
   - Desde la pestaña de **Secretaría Judicial**, cada fila de la agenda cuenta con el botón **"Recordatorio WhatsApp"**.
   - La Secretaría puede hacer clic un día antes de la audiencia para enviar el mensaje de recordatorio automático al número registrado del abogado patrocinante.

---

## 4. Publicación en Google Sites

1. En la esquina superior derecha de Google Sites, haga clic en **Publicar**.
2. En la opción de visibilidad, confirme que esté público para cualquier usuario.
3. Comparta el enlace directo con los abogados y partes procesales.
