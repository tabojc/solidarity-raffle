# Ciclo de Desarrollo con Agentes

## Checklist

### 1. Descubrimiento (`sdd-explore`)
- Investigar el problema antes de escribir código
- Input: Idea, bug report, feature request
- Output: Análisis técnico, tradeoffs, contexto del codebase
- Quién: Tech lead / Senior
- Ejemplo: "Qué tan viable es migrar X librería?" → el agente busca usos actuales, dependencias, breaking changes

### 2. Propuesta (`sdd-propose`)
- Definir QUÉ vamos a hacer y por qué
- Input: Output de exploración
- Output: Propuesta con alcance, enfoque, criterios de éxito
- Quién: Tech lead + PM (revisión)
- Regla: NO código todavía. Solo decisión.

### 3. Especificación (`sdd-spec`)
- Escribir los requirements + escenarios (Given-When-Then)
- Input: Propuesta aprobada
- Output: Spec con ejemplos concretos
- Quién: QA + Dev colaboran
- Regla: Si no se puede especificar, no se puede construir

### 4. Diseño técnico (`sdd-design`)
- Arquitectura, archivos, interfaces, flujo de datos
- Input: Spec
- Output: Diagrama de módulos, contratos de API / tipos, estrategia de testing
- Quién: Senior dev
- Pregunta guía: "Un junior podría implementar esto solo con el diseño?"

### 5. Desglose en tareas (`sdd-tasks`)
- Partir el cambio en unidades atómicas (~1-2h c/u)
- Input: Spec + Design
- Output: Lista de tareas con archivos afectados
- Quién: Tech lead asigna

### 6. Implementación (`sdd-apply`)
- Escribir código con TDD (Test → Código → Refactor)
- Input: Una tarea de la lista
- Output: Código + tests + documentación inline
- Quién: Cualquier dev con el diseño claro

### 7. Verificación (`sdd-verify`)
- Probar que el código cumple la spec
- Input: Tarea completada
- Output: Tests pasando, lint/typecheck ok, evidencia de cada escenario
- Quién: QA automatizado (o dev + revisión)
- Regla: Si el test falla, la tarea NO está completa

### 8. Cierre (`sdd-archive`)
- Actualizar specs con lo que realmente se construyó
- Input: Implementación verificada
- Output: Spec sincronizada, memoria del equipo actualizada
- Quién: Quien implementó
- Por qué: La doc que no refleja la realidad es peor que no tener doc

### Reglas del equipo

| Regla | Explicación |
|---|---|
| No saltar pasos | Si no hay spec, no hay tarea. Si no hay tarea, no hay código. |
| Primero el por qué | Nunca escribir código sin entender el problema primero. |
| TDD obligatorio | Test falla → código que lo pasa → refactor. Sin excepción. |
| Commits como unidades de review | Cada commit = 1 tarea atómica. No commits gigantes. |
| Un agente, un propósito | Investigación con agente de explore, implementación con agente de apply. |
| La memoria es del equipo | Decisiones, bugs, patrones se guardan. No confiar en la memoria humana. |

### Roles en el ciclo

| Paso | Dev Jr | Dev Sr | QA | TL | PM |
|---|---|---|---|---|---|
| Explore | — | ✅ | — | ✅ | — |
| Propose | — | — | — | ✅ | ✅ |
| Spec | — | ✅ | ✅ | — | — |
| Design | — | ✅ | — | — | — |
| Tasks | — | — | — | ✅ | — |
| Apply | ✅ | ✅ | — | — | — |
| Verify | — | — | ✅ | ✅ | — |
| Archive | ✅ | ✅ | — | — | — |

---

## En parrafo / Gobierno del Software

**Descubrimiento (`sdd-explore`)**: El ciclo comienza con la investigación del problema. Un tech lead o dev senior usa un agente de exploración para analizar el contexto, evaluar tradeoffs técnicos y determinar viabilidad antes de escribir código. No se construye nada que no se haya entendido primero. Esta fase absorbe la incertidumbre para que el resto del ciclo sea predecible.

**Propuesta (`sdd-propose`)**: Definir qué vamos a hacer y por qué. Tech lead y PM revisan una propuesta que establece alcance, enfoque y criterios de éxito. En esta fase no se escribe código, solo se toma la decisión de avanzar o descartar. El objetivo es fallar barato si la idea no se sostiene.

**Especificación (`sdd-spec`)**: QA y dev colaboran para escribir requirements en formato Given-When-Then, con ejemplos concretos de comportamiento esperado. Una spec que cualquiera pueda leer y entender. Regla de oro: si no se puede especificar, no se puede construir. Esta fase elimina la ambigüedad antes de invertir en implementación.

**Diseño técnico (`sdd-design`)**: Con la spec clara, un senior dev produce la arquitectura: módulos, contratos de API, tipos compartidos, flujo de datos y estrategia de testing. El diseño debe ser lo suficientemente explícito para que un desarrollador junior pueda implementarlo sin supervisión constante. Aquí se toman las decisiones técnicas que enmarcan toda la implementación.

**Desglose en tareas (`sdd-tasks`)**: El tech lead parte el cambio en unidades atómicas de 1 a 2 horas, cada una con archivos afectados y dependencias explícitas. Cada tarea es un commit potencial y una unidad de review independiente. No hay tareas ambiguas ni gigantes — lo que no se puede partir no se entiende bien.

**Implementación (`sdd-apply`)**: TDD estricto: primero el test que falla, luego el código que lo pasa, después refactor. Cada tarea produce código más tests más documentación inline. Cualquier desarrollador con acceso al diseño puede ejecutar esta fase. El agente de implementación trabaja sobre una tarea a la vez, sin mezclar contextos.

**Verificación (`sdd-verify`)**: QA validación automatizada) ejecuta los tests, verifica lint y typecheck, y confirma que cada escenario de la spec se cumple. Si algo falla la tarea retrocede a implementación. No hay excepciones ni despliegues con tests rojos.

**Cierre (`sdd-archive`)**: Quien implementó sincroniza la documentación con lo que realmente se construyó. Las especificaciones se actualizan para reflejar la realidad del código entregado. Una spec desactualizada es peor que no tener spec — el archivo garantiza que el repositorio de conocimiento refleje fielmente el sistema.
