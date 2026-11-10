# RutaLibre Sport

Aplicación web para registrar y analizar tu deporte, con roles, planes de entrenamiento y parte social.
Nace del prototipo «RutaLibre Amigos» y conserva su estilo: cristal esmerilado sobre manchas de color, acento coral y rutas dibujadas en SVG.

## Qué incluye

| Área | Funciones |
|---|---|
| **Sesiones** | 20 deportes, duración, distancia, desnivel, FC, esfuerzo percibido (RPE), series de gimnasio, valoración con estrellas, notas, privacidad por sesión, búsqueda y filtros |
| **GPX** | Importa la traza de tu reloj: calcula distancia, desnivel y duración, y dibuja la ruta y el perfil de altitud |
| **Cronómetro** | Crono con pausas y parciales; usa el GPS del navegador si está disponible |
| **Estadísticas** | Volumen semanal por deporte, reparto, carga (forma / fatiga / frescura), ritmo al correr, 1RM estimado, calendario de constancia, récords y logros |
| **Objetivos** | Metas semanales o mensuales por distancia, tiempo o sesiones |
| **Plan y calendario** | Calendario mensual con lo hecho y lo planificado; los entrenadores crean planes y los asignan |
| **Social** | Feed de amigos, ánimos, comentarios, clasificación semanal y mensual |
| **Retos** | Metas compartidas con fecha de cierre y ranking |
| **Cuerpo** | Peso, grasa, pulso en reposo y sueño |
| **Administración** | Usuarios, roles, entrenador asignado, suspensión de cuentas, matriz de permisos y auditoría |
| **Ajustes** | Tema claro/oscuro, km o millas, privacidad por defecto, exportar (JSON, CSV) e importar |

## Roles

| Rol | Puede |
|---|---|
| **Invitado** | Ver lo público: feed, retos y clasificación |
| **Atleta** | Registrar y analizar su entrenamiento, objetivos, amigos y retos |
| **Entrenador** | Lo anterior, más crear planes y retos y ver el progreso de sus atletas |
| **Administrador** | Todo, más gestionar usuarios y roles, moderar y restablecer datos |

Los permisos se definen en `src/lib/permissions.ts` y se comprueban en cada acción de `src/lib/store.ts`, no solo en la interfaz.

Cuentas de ejemplo (contraseña `demo1234`): Álex (atleta), Elena (entrenadora), Sofía (administradora) e Invitado.

## Importante: dónde viven los datos

Esta versión guarda todo en el `localStorage` del navegador. Eso significa que **las cuentas y los roles no son seguridad real**: sirven para un uso personal o una demo, pero cualquiera con acceso al navegador puede leer los datos.
Para un uso compartido de verdad hay que sustituir `src/lib/store.ts` por un backend con autenticación (la interfaz no cambia).

## Desarrollo

```bash
npm install
npm run dev            # servidor local
npm test               # tests de métricas, GPX, roles y sesión
npm run build          # web estática en dist/
npm run build:artifact # un único HTML en dist-artifact/rutalibre-sport.html
```

Stack: React 18, TypeScript y Vite. Las gráficas son SVG propio, sin librerías.

## Referencias

Funciones inspiradas en proyectos abiertos de seguimiento deportivo: [wger](https://github.com/wger-project/wger), [workout-cool](https://github.com/Snouzy/workout-cool), [Endurain](https://github.com/endurain-project/endurain) y [workout-tracker](https://github.com/jovandeginste/workout-tracker).
