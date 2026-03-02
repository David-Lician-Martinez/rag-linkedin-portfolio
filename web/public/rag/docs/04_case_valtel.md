# Case Study — Predicción del Precio de Vehículos (VALTEL)

## 1. Contexto de negocio

Empresa: VALTEL  
Sector: Venta de vehículos de segunda mano.

Objetivo empresarial:
Ofrecer vehículos a precios competitivos para diversificar la cartera de productos y posicionarse como comercial dominante en un nicho específico.

Problema:
Determinar el precio óptimo de cada vehículo en función de sus características técnicas y de mercado.

Impacto esperado:
- Mejora en competitividad.
- Aumento de conversión.
- Decisiones de pricing basadas en datos.

---

## 2. Marco metodológico

Se aplicó la metodología CRISP-DM:

1. Business Understanding
2. Data Understanding
3. Data Preparation
4. Modeling
5. Evaluation
6. Deployment

El enfoque garantizó alineación constante entre decisiones técnicas y valor de negocio.

---

## 3. Datos utilizados

Dataset proporcionado por I+D:

- 11.199 registros.
- Variable objetivo:
  - Precio

Principales variables predictoras:
- CV (potencia)
- Número de cilindros
- Mercado (segmento)
- Año
- Consumo

Hallazgos iniciales:
- A mayor potencia y cilindrada, mayor precio.
- Vehículos más recientes presentan mayor precio medio.
- El mercado segmenta significativamente la distribución del precio.

---

## 4. Preparación de los datos

Problemas detectados:

- 3.742 valores nulos en variable Mercado (≈31.4%).
- 715 registros duplicados (≈6.4%).
- Gran presencia de outliers.
- Correlaciones no lineales entre variables.
- Variable redundante: Consumo en Ciudad.

Decisiones adoptadas:

- Creación de dos datasets:
  1. Dataset con imputación de nulos.
  2. Dataset eliminando filas con nulos.
- Eliminación de duplicados.
- Eliminación de variable redundante (Consumo en Ciudad).
- Selección de modelos basados en árboles (robustos a outliers y no linealidad).

---

## 5. Modelado

Modelos evaluados:

- Árbol de Decisión
- Random Forest
- XGBoost

Características comunes:
- No requieren escalado.
- Toleran outliers.
- Capturan relaciones no lineales.
- Manejan múltiples variables eficientemente.

Estrategia de entrenamiento:

- 80% datos → entrenamiento.
- 20% datos → evaluación.
- Validación cruzada.
- Total modelos generados:
  3 modelos × 2 datasets = 6 configuraciones.

---

## 6. Resultados

### Dataset con nulos eliminados

Random Forest:
- MAE: 4677.43
- RMSE: 21846.95
- R²: 0.9137

Árbol de Decisión:
- MAE: 5124.49
- RMSE: 23423.72
- R²: 0.9008

XGBoost:
- MAE: 4971.11
- RMSE: 15680.18
- R²: 0.9556

---

### Dataset con nulos imputados (mejor rendimiento)

Random Forest:
- MAE: 3060.03
- RMSE: 6332.32
- R²: 0.9826

Árbol de Decisión:
- MAE: 3215.62
- RMSE: 6707.06
- R²: 0.9805

XGBoost:
- MAE: 3404.06
- RMSE: 6277.15
- R²: 0.9829

---

## 7. Modelo seleccionado

Se seleccionó el Árbol de Decisión entrenado con el dataset imputado.

Justificación:

- Rendimiento prácticamente equivalente a los modelos ensemble.
- Mayor interpretabilidad.
- Mayor facilidad de explicación para stakeholders.
- Mejor alineación con objetivos de negocio.

R² ≈ 0.98 indica que el modelo explica aproximadamente el 98% de la varianza del precio.

---

## 8. Estrategia de despliegue propuesta

Fases:

1. Prueba piloto en subconjunto de clientes.
2. Monitorización de métricas.
3. Definición de KPIs:
   - Satisfacción del cliente.
   - Porcentaje de conversión.
4. Reentrenamiento periódico si se detecta degradación (MLOps).
5. Automatización del proceso de pricing.

---

## 9. Impacto empresarial esperado

- Mejora en estrategia de pricing.
- Reducción de errores humanos.
- Mejora en consistencia de precios.
- Ventaja competitiva basada en analítica.

---

## 10. Palabras clave (para retrieval)

Regression, Pricing Model, Decision Tree, Random Forest, XGBoost, CRISP-DM, MAE, RMSE, R2, Data Cleaning, Missing Values, Business Alignment, Interpretability, Vehicle Pricing.