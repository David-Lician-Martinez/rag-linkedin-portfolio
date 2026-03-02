# Case Study — Predicción de Demanda en Servicios de Reparto (TFM)

## 1. Contexto de negocio

Una empresa de restauración con más de 10 años de operación realizaba la planificación semanal de personal basándose en intuición y experiencia.

Problema:
- Picos de demanda impredecibles.
- Necesidad de elaborar horarios con 1–2 semanas de antelación.
- Riesgo de:
  - Sobredimensionamiento de plantilla (coste innecesario).
  - Infradimensionamiento (retrasos y clientes insatisfechos).

La predicción debía realizarse por:
- Semana completa.
- Tramos de 30 minutos.
- Diferenciando pedidos totales y pedidos a domicilio.

---

## 2. Objetivo técnico

Desarrollar un modelo capaz de:

- Predecir la demanda semanal.
- Desagregarla por tramos de 30 minutos.
- Distinguir entre:
  - Pedidos totales.
  - Pedidos a domicilio.
- Garantizar disponibilidad de variables con al menos 2 semanas de antelación (simulación realista de despliegue).

---

## 3. Datos utilizados

### 3.1 Datos internos
- 511 días de registros históricos.
- Intervalos de 30 minutos.
- Clasificación de pedidos:
  - Local
  - Recoger
  - Domicilio

### 3.2 Fuentes externas integradas
- Datos climatológicos (API SiAR – MAPA).
- Festividades nacionales y locales (web scraping).
- Eventos futbolísticos (API LaLiga).
- Euríbor a 12 meses (API Banco de España).

Conclusión del EDA:
- Fuerte estacionalidad semanal.
- Patrones horarios marcados.
- Impacto significativo de festivos y partidos.
- Impacto irrelevante del euríbor.
- Impacto débil o nulo de precipitaciones.

---

## 4. Metodología

Se siguió una estructura alineada con CRISP-DM:

1. Business Understanding
2. Data Understanding
3. Data Preparation
4. Modeling
5. Evaluation

### 4.1 Preprocesado

- Limpieza y validación de consistencia.
- Feature engineering:
  - Lags temporales.
  - Variables exógenas.
  - Indicadores de día de semana y franja horaria.
- Control estricto de data leakage:
  - Variables no conocidas con antelación se retardaron ≥ 672 registros.

---

## 5. Modelos evaluados

### Modelos clásicos
- SARIMAX
- Prophet

Capturan tendencia y estacionalidad lineal.

### Machine Learning
- Random Forest
- XGBoost
- LightGBM

Requirieron generación explícita de variables de rezago.

### Deep Learning
- LSTM
- GRU

Capturan dependencias secuenciales complejas.

### Modelo híbrido (ganador)
Media móvil estacional + LightGBM

Arquitectura:
1. Media móvil estacional → captura patrón semanal.
2. LightGBM → modela los residuos no explicados.

---

## 6. Estrategia de validación

Se aplicó Time Series Cross-Validation (TSCV):

- Configuración 80-10-10:
  - Train
  - Validation
  - Test (out-of-sample realista)

Se compararon:
- Ventanas sliding (fijas)
- Ventanas expanding (crecientes)

Métricas principales:
- MAE (Mean Absolute Error)
- MAPE (Mean Absolute Percentage Error)

---

## 7. Resultados

El modelo híbrido obtuvo el mejor desempeño global:

- MAE global ≈ 0.83 pedidos
- MAPE global ≈ 53.25 %

Interpretación operativa:

En promedio, el modelo se equivoca:
- Menos de 1 pedido por franja en domicilio.
- Menos de 1.5 pedidos en pedidos totales.

El modelo híbrido superó:
- Modelos clásicos puros.
- Modelos de deep learning.
- Modelos naive.

---

## 8. Impacto empresarial

Beneficios directos:

- Optimización de planificación de personal.
- Reducción de sobrecostes.
- Mejora en tiempos de servicio.
- Reducción de incertidumbre en la toma de decisiones.

El sistema transforma intuición en decisión basada en datos.

---

## 9. Limitaciones

- Solo 1.5 años de histórico.
- No se incluyó información de competencia.
- Algunos picos extremos siguen siendo difíciles de capturar.

---

## 10. Futuras líneas de trabajo

- Despliegue automatizado en entorno cloud.
- Integración con base de datos operativa.
- Generación automática de predicciones semanales.
- Incorporación de más histórico y fuentes adicionales.

---

## Palabras clave (para retrieval)

Time Series Forecasting, Demand Forecasting, SARIMAX, Prophet, LightGBM, LSTM, GRU, Hybrid Models, Time Series Cross Validation, MAE, MAPE, Feature Engineering, CRISP-DM, Business Impact, Operational Optimization.