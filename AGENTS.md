# 🤖 Agent Guidelines & Capabilities

Este documento resume las habilidades (Skills) y servidores MCP (Model Context Protocol) disponibles para los agentes de IA que operan en este repositorio. Los agentes deben consultar y utilizar estas herramientas para mantener la consistencia del proyecto y seguir el flujo de trabajo establecido.

## 🧠 Skills Disponibles

Las siguientes skills están configuradas en este entorno para proporcionar flujos de trabajo especializados:

### 1. Flujo de Desarrollo (Speckit)
Speckit es el motor principal para llevar funcionalidades desde la idea hasta el código de forma estructurada:
- **`speckit-constitution`**: Define y gestiona los principios de arquitectura y reglas del proyecto.
- **`speckit-specify`**: Crea/actualiza la especificación funcional (`spec.md`).
- **`speckit-clarify`**: Resuelve ambigüedades en la especificación haciendo preguntas clave.
- **`speckit-plan`**: Genera el plan técnico de implementación y arquitectura (`plan.md`).
- **`speckit-checklist`**: Genera listas de verificación de calidad/seguridad.
- **`speckit-tasks`**: Convierte el plan en una lista de tareas ordenadas por dependencia (`tasks.md`).
- **`speckit-analyze`**: Realiza un análisis de consistencia cruzada entre spec, plan y tasks.
- **`speckit-implement`**: Ejecuta iterativamente las tareas de código.
- **`speckit-converge`**: Audita el código final contra la especificación y agrega tareas faltantes si es necesario.
- **`speckit-taskstoissues`**: Exporta las tareas locales como GitHub Issues.

### 2. Utilidades y Productividad
- **`context7-mcp`**: Reglas sobre cuándo y cómo usar Context7 para buscar documentación de frameworks actualizados.
- **`mermaid-skill`**: Generación experta de diagramas Mermaid (arquitectura, flujos, bases de datos).
- **`git-change-publisher`**: Preparación, generación de *Conventional Commits* y publicación automática de ramas/PRs.
- **`commit-message-writer`**: Redacción limpia de mensajes de commit basados en el *staging area*.
- **`caveman`**: Modos de comunicación ultracomprimidos para ahorrar tokens de contexto en sesiones largas.
- **`ponytail` (Plugin Global)**: Enfoque antimagia y antiobreingeniería (YAGNI). Úsalo (vía `/ponytail-review`, `/ponytail-audit`, o pidiendo "ponytail mode") para forzar la solución más simple posible, usando la librería estándar antes que dependencias, y eliminando abstracciones innecesarias.

---

## 🔌 Servidores MCP (Contexto Externo)

Se recomienda que los agentes utilicen los siguientes servidores MCP (cuyas plantillas están en `mcp-config.json` y deben configurarse globalmente en el cliente):

### 1. Context7 (`context7`)
- **Propósito**: Proporciona acceso en tiempo real a documentación oficial, SDKs, y ejemplos de código actualizados de la web.
- **Cuándo usarlo**: Siempre que el agente necesite escribir código usando frameworks de terceros (ej: React, Tailwind, FastAPI) para evitar alucinaciones o el uso de APIs obsoletas.
- **Herramientas principales**: `resolve-library-id`, `query-docs`.

### 2. GitHub (`github-mcp-server`)
- **Propósito**: Integración directa con la API de GitHub.
- **Cuándo usarlo**: Para gestionar repositorios, leer código remoto, administrar Pull Requests, buscar Issues, o crear ramas directamente desde el chat.
- **Herramientas principales**: `create_pull_request`, `search_repositories`, `list_issues`, `create_branch`, `get_file_contents`.
