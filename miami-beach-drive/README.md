# Miami Beach Drive

Juego 3D en el navegador (WebGL 2 / Three.js, todo en la GPU) ambientado en Miami Beach: Ocean Drive, Collins Avenue, edificios Art Deco pastel con neón, palmeras, torres de salvavidas y un océano animado con shader propio.

## Cómo jugar
Abre `index.html` en Chrome, Edge o Firefox (necesita internet para cargar Three.js desde jsDelivr).

| Control | Acción |
|---|---|
| W A S D / flechas | Conducir (S/↓ frena y da reversa) |
| Espacio | Freno de mano: derrapes |
| H | Claxon (el tráfico frena) |
| C | Cámara: persecución / cinemática / capó / aérea |
| R | Radio (música synthwave generada en vivo) |
| P | Foto (descarga PNG) |
| Esc | Pausa / cambiar vehículo y color |
| Ratón | Arrastra para girar la cámara, rueda para zoom |
| Gamepad | Stick izq. dirección, RT gas, LT freno, A freno de mano, Y claxon |

En móvil aparecen botones táctiles.

**Qué hacer:**
- **Misiones de taxi:** recoge pasajeros (círculo amarillo) y llévalos a su destino (verde) antes de que se acabe el tiempo. Los saltos con pasajero dan propina.
- **Rampas:** son rosas, están en la playa y en las calles transversales. Cuanto más tiempo en el aire, más dinero.
- **Derrapes:** con el freno de mano a alta velocidad, que suman puntos.
- **Estrellas de neón:** 30 repartidas por el mapa, algunas solo se alcanzan saltando.
- **Pelotas de playa:** las puedes patear con el coche.
- **Vehículos:** 3 con física distinta (Convertible, Scooter, Jeep, que es el rey de la arena) y 8 colores.
- **Hora del día:** de la tarde a la noche, con la barra en ⚙️ o en ciclo automático. De noche se encienden el neón, las ventanas, las farolas y los faros.

## GPU harness
Panel abajo a la derecha:
- **Info de la GPU:** nombre (se marca en verde si es NVIDIA), versión de WebGL, FPS, tiempo de frame y **tiempo real de GPU** (`EXT_disjoint_timer_query_webgl2`).
- **Estadísticas de render:** draw calls, triángulos, resolución y gráfico de frame time.
- **Presets Low / Medium / High / Ultra:** cambian la escala de resolución, el bloom, el tamaño del shadow map, la cantidad de palmeras y de tráfico y la resolución de la malla del océano.
- **Benchmark de 30 s:** piloto automático por todo el circuito mientras la hora pasa de la tarde a la noche. Reporta FPS promedio, 1% low, p50/p95/p99, tiempo de GPU y una nota (S/A/B/C/D), y se puede descargar en JSON.

Para pruebas automáticas: `?q=ultra&bench=30`. El resultado queda en `window.__bench` y en la consola como `BENCH {...}`. También existe `?tod=0.9` para fijar la hora.

### Correrlo en una GPU NVIDIA en la nube
En una VM con GPU NVIDIA y escritorio remoto, abre el archivo en Chrome y verifica en `chrome://gpu` que WebGL use la GPU (no "SwiftShader"). Para correrlo en modo headless con la GPU:

```bash
google-chrome --headless=new --use-angle=vulkan --enable-gpu --ignore-gpu-blocklist "file:///ruta/miami-beach-drive/index.html?q=ultra&bench=30"
```
