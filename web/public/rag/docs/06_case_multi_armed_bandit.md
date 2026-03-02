# Case Study — Optimización de Banners con Bandido Multibrazo

## 1. Contexto del problema

En marketing digital, mostrar siempre el mismo banner no es óptimo si no conocemos cuál maximiza el CTR (Click Through Rate).

Problema:
- Tenemos varios banners posibles.
- No conocemos su probabilidad real de clic.
- Necesitamos maximizar el número total de clics acumulados.

Dilema fundamental:
Exploración vs Explotación.

- Exploración: probar banners nuevos para estimar su rendimiento.
- Explotación: mostrar el banner que históricamente ha funcionado mejor.

Este problema se modeliza como un **Multi-Armed Bandit (MAB)**.

---

## 2. Formulación teórica

Cada banner se modela como un "brazo" de una máquina tragaperras.

Para cada brazo i:
- Existe una probabilidad desconocida de éxito p_i.
- La recompensa es binaria: 1 (clic) o 0 (no clic).

Objetivo:
Maximizar la recompensa acumulada total a lo largo del tiempo.

Estrategia aplicada:
Algoritmo **Epsilon-Greedy**.

---

## 3. Algoritmo Epsilon-Greedy

Definición:

Con probabilidad ε:
→ Se explora (se elige un brazo aleatorio).

Con probabilidad (1 − ε):
→ Se explota (se elige el brazo con mayor media histórica).

Parámetro clave:
- ε controla el equilibrio exploración/explotación.
- Valores pequeños → más explotación.
- Valores grandes → más exploración.

---

## 4. Implementación

Estructura general del notebook:

1. Inicialización:
   - Número de brazos (banners).
   - Número total de iteraciones.
   - Vector de recompensas acumuladas.
   - Conteo de selecciones por brazo.

2. Simulación:
   - En cada iteración:
     - Decisión explorar/explotar.
     - Selección de banner.
     - Generación de recompensa simulada.
     - Actualización de medias empíricas.

3. Cálculo de métricas:
   - Recompensa acumulada.
   - Número de veces que se selecciona cada brazo.
   - Evolución de la media estimada.

---

## 5. Resultados observados

Comportamiento típico del algoritmo:

- Fase inicial:
  Alta exploración.
  Las medias estimadas son inestables.

- Fase intermedia:
  Se identifica un brazo superior.

- Fase final:
  El algoritmo converge hacia el brazo óptimo.
  La mayoría de las selecciones se concentran en el banner con mayor probabilidad real de clic.

Efecto clave:
El algoritmo reduce el "regret" acumulado frente a una estrategia puramente aleatoria.

---

## 6. Interpretación empresarial

Beneficios:

- Incremento progresivo del CTR.
- Reducción del coste de oportunidad.
- Adaptabilidad ante incertidumbre.
- Base para sistemas de recomendación más avanzados.

Aplicaciones reales:

- Optimización de anuncios.
- Testing dinámico de creatividades.
- Selección automática de promociones.
- Sistemas de recomendación online.

---

## 7. Limitaciones

- Epsilon fijo puede no ser óptimo.
- No incorpora intervalos de confianza.
- No es óptimo frente a estrategias como:
  - UCB (Upper Confidence Bound)
  - Thompson Sampling

No modeliza cambios en el tiempo (no contextual).

---

## 8. Posibles mejoras

- Epsilon decreciente (annealing).
- Implementación de UCB.
- Implementación de Thompson Sampling.
- Bandido contextual (incorporar features del usuario).

---

## 9. Aprendizajes clave

- El equilibrio exploración/explotación es central en sistemas adaptativos.
- Algoritmos simples pueden generar mejoras significativas.
- La simulación es una herramienta poderosa para entender sistemas estocásticos.
- La optimización online es diferente a la predicción supervisada tradicional.

---

## Palabras clave (para retrieval)

Multi-Armed Bandit, Reinforcement Learning, Epsilon-Greedy, Exploration vs Exploitation, CTR Optimization, Online Learning, Regret Minimization, Marketing Optimization, Adaptive Algorithms.