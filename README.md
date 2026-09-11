# MisiOps

Proyecto de DevOps

## Descripción

Quién no ha tenido problemas gestionando sus finanzas personales? Pues este dolor de cabeza se acabo! con MisiOps podrás tener un control total de tus gastos, ingresos y presupuestos de manera sencilla y eficiente.

## Configuración de Servidores MCP (Model Context Protocol)

Este proyecto recomienda el uso de servidores MCP para otorgarle a tus agentes de IA contexto en tiempo real. Específicamente recomendamos:

- **Context7**: Para buscar documentación actualizada y ejemplos de código de frameworks.
- **GitHub**: Para que la IA pueda leer issues, commits, y gestionar Pull Requests.

Dado que estos servidores son de uso general, la recomendación del equipo es que los configures en el entorno **global** de tu IDE o Agente, para que los tengas disponibles en cualquier proyecto.

### 1. Plantilla Base

En la raíz de este repositorio encontrarás el archivo [`mcp-config.json`](./mcp-config.json). Este archivo contiene la definición de los servidores.

### 2. Requisitos Previos (Tokens)

Para que los servidores funcionen, deberás reemplazar los marcadores `<GITHUB_TOKEN>` y `<CONTEXT7_TOKEN>` por tus propias credenciales en tu máquina:

- **GITHUB_PERSONAL_ACCESS_TOKEN**: Genera un token desde GitHub (Developer Settings).
- **CONTEXT7_API_KEY**: Obtén tu API Key desde el dashboard de [Context7](https://context7.com) (opcional pero recomendado para no depender de la cuota pública).

---

### 3. Guía de Integración por Agente

A continuación, abre el archivo global de tu herramienta favorita y pega el bloque `mcpServers` definido en nuestra plantilla. **Recuerda reemplazar los tokens con tus credenciales reales.**

#### 🟢 Antigravity

Abre tu archivo de configuración global:

- **Ruta Windows**: `~/.gemini/config/mcp_config.json`
- **Ruta Mac/Linux**: `~/.gemini/config/mcp_config.json`
- Agrega los servidores, guarda el archivo y reinicia el agente para que cargue las herramientas.

#### 🔵 Cursor IDE

Puedes hacerlo desde la interfaz gráfica o editando el archivo:

- Ve a `Cursor Settings > Features > MCP` y añade los servidores usando el comando `npx`.
- Alternativamente, edita el archivo global que se encuentra en la carpeta de usuario `.cursor/mcp.json`.

#### 🟠 Codex

- Abre tu archivo de configuración global:
- **Ruta Windows**: `~/.codex/config/mcp_config.json`
- **Ruta Mac/Linux**: `~/.codex/config/mcp_config.json`

#### 🟣 Claude Desktop

La app de escritorio de Claude requiere configuración estrictamente global. Edita el siguiente archivo:

- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- Reinicia la aplicación completamente (cmd+Q / Alt+F4) para que aplique los cambios.

---

### 4. Plugins Adicionales (Ponytail)

Este equipo promueve evitar la sobreingeniería y mantener las soluciones lo más simples posibles. Para ayudar con esto, utilizamos el plugin **Ponytail**.

#### Instalación

Dado que Ponytail es un plugin global, cada miembro del equipo debe instalarlo en su máquina. En cada agente, escribir el prompt:

> Instala Ponytail https://github.com/dietrichgebert/ponytail.git en el agente y revisa que esté funcionando correctamente.

---

### 5. Skills Locales del Repositorio

Además de estas herramientas globales, el repositorio incluye un conjunto de **Skills Locales** (como _Speckit_, _Caveman_ y utilidades de Git) que se cargan automáticamente al abrir el proyecto.
