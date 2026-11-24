# Miami Beach Drive

Juego 3D de mundo abierto en el navegador (WebGL 2 / Three.js, todo en la GPU) ambientado en Miami Beach: Ocean Drive, Collins Avenue, edificios Art Deco pastel con neón, palmeras, playa, muelle y un océano animado.

## Jugar
Abre `index.html` en Chrome, Edge o Firefox. Es **un solo archivo autocontenido**: funciona sin internet y se puede subir tal cual a un portal de juegos.

### Controles
| | En vehículo | A pie |
|---|---|---|
| W A S D / flechas | Conducir | Caminar (relativo a la cámara) |
| Shift | — | Correr |
| Espacio | Freno de mano (derrape) | Saltar |
| F / Enter | Bajarse | Subir a un vehículo, pedir prestado un auto o abrir el garaje |
| Q / E, arrastrar ratón | Girar cámara | Girar cámara |
| H | Claxon | — |

Otras teclas: **C** cámara (persecución, cinemática, primera persona, aérea), **R** radio, **P** foto, **G** aceptar oferta con anuncio y **Esc** pausa y logros.

**Gamepad:** stick izquierdo para moverse, RT/LT para acelerar y frenar, A para derrapar o saltar, B para el claxon, X para correr, Y para subir o bajar y stick derecho para la cámara. En móvil hay botones táctiles, incluido 🚪 para subir y bajar.

### Qué hacer
- **Bajarse y explorar a pie:** caminar, correr, saltar, nadar en el mar y caminar por el muelle.
- **Pedir prestado cualquier auto del tráfico:** el conductor se baja molesto.
- **Misiones de taxi:** recoger pasajeros (te saludan con la mano) y llevarlos a su destino. Los saltos con pasajero dan propina.
- **Peatones:** caminan por las aceras y la playa y se apartan de tu camino. Si atropellas a uno, se cae, se levanta enojado y pagas una multa.
- **Garaje Brisa (G en el mapa):** comprar vehículos (Scooter, Jeep, moto acuática), pinturas y luces de neón bajo el vehículo, todo con dinero del juego.
- **Moto acuática:** sale del muelle y permite explorar el mar, donde hay estrellas que solo se alcanzan por agua.
- **12 logros**, rampas, derrapes, 30 estrellas, pelotas de playa que puedes patear y ciclo de día y noche.
- **Guardado automático:** dinero, vehículos, colores y logros se guardan en el navegador.

## Monetización (lista para conectar)
`src/main.js` tiene un adaptador `Ads` con anuncios con recompensa en tres lugares:
1. **Duplicar el pago** al terminar un viaje (8 s para aceptar con G o con el botón).
2. **+30 s** cuando se acaba el tiempo de un viaje.
3. **+$50 "Patrocinio del día"** en el garaje, cada 3 minutos.

Sin SDK, el juego muestra un **anuncio simulado** de 3 s. Si la página carga el SDK de **CrazyGames** (`window.CrazyGames.SDK`) o de **Poki** (`window.PokiSDK`), los usa automáticamente. También llama a `gameplayStart` y `gameplayStop` al pausar, abrir el garaje o ver anuncios, y silencia el audio durante el anuncio. Para publicar en un portal, agrega la etiqueta `<script>` de su SDK en `src/index.html` y vuelve a compilar. Sigue siempre la documentación oficial del portal: esta integración **no está probada con los SDK reales**.

## GPU harness
Panel abajo a la derecha:
- **Info de la GPU:** nombre (en verde si es NVIDIA), FPS, tiempo de frame y tiempo real de GPU (`EXT_disjoint_timer_query_webgl2`).
- **Estadísticas de render:** draw calls, triángulos y gráfico de frame time.
- **Presets Low / Medium / High / Ultra:** cambian la resolución, el bloom, las sombras, la cantidad de palmeras, tráfico y peatones y el detalle del océano.
- **Benchmark de 30 s:** piloto automático con tráfico y peatones mientras pasa de la tarde a la noche. Da una nota S–D y se puede exportar a JSON.

Automatización: `?q=ultra&bench=30` deja el resultado en `window.__bench` y en la consola como `BENCH {...}`. También existe `?tod=0.9` para fijar la hora.

En una VM con GPU NVIDIA:
```bash
google-chrome --headless=new --use-angle=vulkan --enable-gpu --ignore-gpu-blocklist "file:///ruta/miami-beach-drive/index.html?q=ultra&bench=30"
```

## Desarrollo
El código fuente está en `src/` (`index.html` con HTML y CSS, `main.js` con el juego). El archivo `index.html` de la raíz se genera:
```bash
npm install
```
```bash
npm run build
```
