# Case Study — RAG para Portfolio Profesional (LinkedIn / Web Assistant)

## 1. Problema a resolver

Los asistentes basados en LLM presentan dos problemas principales cuando se usan como “portfolio interactivo”:

1. Alucinaciones.
2. Respuestas genéricas no alineadas con el perfil real.
3. Imposibilidad de garantizar que la información provenga de contenido documentado.

Objetivo del proyecto:

Construir un sistema RAG (Retrieval-Augmented Generation) que:

- Responda exclusivamente con información documentada.
- Cite fuentes internas.
- Sea seguro frente a abuso.
- Esté preparado para despliegue real.

---

## 2. Enfoque arquitectónico

El sistema se basa en una arquitectura moderna serverless:

Usuario → Frontend Web → Cloudflare Worker → OpenAI API → Respuesta con contexto recuperado

Elementos clave:

- GitHub como repositorio central del proyecto.
- Integración continua GitHub → Cloudflare.
- Cloudflare Workers como capa backend serverless.
- OpenAI API como motor LLM.
- Corpus estructurado en Markdown.

---

## 3. Diseño del Corpus (Professional Pack)

Se creó un corpus propio estructurado en:

- About
- CV público
- Casos prácticos (Telepizza, VALTEL, Bandido, eCommerce)
- Skills Matrix
- FAQ

Características del corpus:

- Documentos cortos y semánticamente coherentes.
- Estructura orientada a retrieval.
- Sin datos sensibles.
- Redacción optimizada para chunking.

Objetivo:

Que el modelo solo pueda responder usando información previamente documentada.

---

## 4. Integración GitHub + Cloudflare

Pipeline implementado:

1. Desarrollo local.
2. Commits versionados en GitHub.
3. Integración automática con Cloudflare.
4. Despliegue continuo mediante Workers.

Beneficios:

- Control de versiones.
- Historial auditado.
- Despliegue rápido.
- Arquitectura reproducible.

---

## 5. Seguridad y Protección

### 5.1 Gestión de credenciales

- API Keys de OpenAI almacenadas como **Secrets en Cloudflare**.
- No se exponen en frontend.
- No se almacenan en el repositorio.

### 5.2 Protección anti-bots

- Integración de **Cloudflare Turnstile**.
- Validación previa antes de permitir llamadas al Worker.
- Prevención de abuso automatizado.

### 5.3 Rate Limiting

- Activación de límites de uso.
- Control de llamadas por IP.
- Reducción de riesgo de consumo excesivo de API.

El sistema está diseñado con mentalidad de producción desde el inicio.

---

## 6. Estrategia RAG (v1)

Estado actual:

- Corpus estructurado.
- Worker funcional.
- Llamadas a OpenAI integradas.
- Seguridad activa.

Próxima fase:

- Implementación de embeddings precomputados.
- Vector store.
- Retrieval basado en similitud semántica.
- Respuestas con citas explícitas.

Objetivo final:

Sistema RAG real con:

- Embeddings persistentes.
- Recuperación contextual.
- Citas trazables.
- Minimización de alucinaciones.

---

## 7. Decisiones técnicas justificadas

¿Por qué Cloudflare Workers?

- Serverless.
- Baja latencia.
- Integración directa con seguridad.
- Escalabilidad automática.

¿Por qué separar corpus en Markdown?

- Transparencia.
- Versionado.
- Control total del conocimiento.
- Fácil actualización.

¿Por qué seguridad desde el inicio?

Porque un portfolio público con API abierta sin protección:

- Es vulnerable.
- Es costoso.
- No es profesional.

---

## 8. Limitaciones actuales

- Embeddings aún no persistentes.
- Sin sistema de citas automatizadas.
- Sin métricas de evaluación del retrieval.
- Sin monitorización avanzada de uso.

---

## 9. Próximos pasos

- Implementar embeddings offline.
- Crear sistema de chunking controlado.
- Añadir citación automática.
- Añadir logging estructurado.
- Medir latencia y coste por consulta.
- Implementar fallback controlado.

---

## 10. Aprendizajes clave

- La arquitectura importa más que el prompt.
- La seguridad debe diseñarse desde el inicio.
- Un RAG bien estructurado requiere un corpus bien diseñado.
- Documentar el sistema es parte del sistema.

---

## 11. Palabras clave (para retrieval)

RAG, Retrieval-Augmented Generation, Cloudflare Workers, GitHub Integration, OpenAI API, Serverless Architecture, Turnstile, Rate Limiting, Vector Embeddings, Portfolio Assistant, Secure AI Deployment.