# Cómo publicar Miami Beach Drive y empezar a facturar

Revisa siempre los términos vigentes de cada plataforma: cambian con frecuencia. Lo que sigue es una guía práctica, no asesoría legal ni fiscal.

## 0. Antes de publicar (1–2 semanas)
1. **Nombre y marca propios.** No uses "GTA", "Grand Theft Auto", "Rockstar" ni nada parecido en el título, la descripción, las miniaturas o las etiquetas. Son marcas registradas y los portales rechazan esos juegos (o los retiran después). Puedes describirlo como "juego de mundo abierto en Miami", nunca como "estilo GTA".
2. **Que lo prueben otras personas.** Pide a 5–10 personas que jueguen 15 minutos y anota dónde se aburren o se pierden. Los portales miden la retención: si la gente se va en el primer minuto, no pasan a la fase con ingresos.
3. **Rendimiento.** Corre el benchmark (botón en el panel GPU) en una laptop modesta y en un celular. Si baja de 30 FPS, juega en "Low" o "Medium" y ajusta.
4. **Material gráfico.** Prepara miniaturas (en distintos tamaños, según cada portal), un video corto del juego (15–30 s) y una descripción con las instrucciones. Usa la tecla **P** (foto) en buenos momentos: atardecer, de noche o en pleno salto.

## 1. CrazyGames (recomendado para empezar)
Fuente: [docs.crazygames.com](https://docs.crazygames.com/requirements/intro/)
1. Crea una cuenta en el **Developer Portal** de CrazyGames.
2. Agrega su SDK v3: pon la etiqueta `<script>` del SDK que indica su documentación en el `<head>` de `src/index.html` y vuelve a compilar con `npm run build`. El juego ya llama a `CrazyGames.SDK.init()`, a `requestAd('rewarded', …)` y a `gameplayStart`/`gameplayStop`, y silencia el audio durante los anuncios.
3. Comprime `index.html` en un `.zip` y súbelo. Usa su herramienta de vista previa para comprobar que los anuncios con recompensa funcionan.
4. **Basic launch:** primero sale sin anuncios para medir cómo juega la gente. Si las métricas son buenas, pasa a **full launch** con QA completo y empieza el reparto de ingresos por publicidad.
5. **Cobro:** configura tus datos de pago y fiscales en el portal. Ellos indican el método y el mínimo para pagar.

## 2. Poki (más selectivo, más tráfico)
Fuente: [sdk.poki.com](https://sdk.poki.com/)
1. Postula el juego en **Poki for Developers**. Revisan cada juego y deciden si encaja.
2. Si lo aceptan, integra su SDK (el juego ya llama a `PokiSDK.init()`, `rewardedBreak()` y `gameplayStart`/`gameplayStop`) y cumple sus requisitos obligatorios.
3. Según su sitio, reparten 50/50 los ingresos de jugadores que llegan por Poki. Suelen pedir exclusividad web, así que **no publiques en Poki y CrazyGames a la vez sin leer los contratos**.

## 3. Otras vías (en paralelo, si los contratos lo permiten)
- **itch.io:** sube el `.zip` como juego HTML5 con "paga lo que quieras". Sirve para darte a conocer y recibir comentarios.
- **Tu propia web:** un dominio, el `index.html` y, más adelante, una red de anuncios para juegos web. Exige mucho tráfico propio (TikTok, YouTube Shorts).
- **Steam o móvil:** solo cuando el juego tenga mucho más contenido (ver abajo).

## 4. Facturar y cobrar
1. **Formaliza la actividad** en tu país: registro como persona con negocio o empresa y número de contribuyente. Los ingresos de portales extranjeros suelen tratarse como exportación de servicios. **Habla con un contador local.**
2. **Cuenta para cobrar en dólares o euros:** cuenta bancaria que acepte transferencias internacionales, o un servicio como Payoneer o Wise.
3. **Formularios fiscales de EE. UU.:** muchas plataformas te pedirán el **W-8BEN** (persona) o el **W-8BEN-E** (empresa) para no retenerte impuestos de EE. UU. de más. Se llena dentro de su portal de pagos.
4. **Emite tu comprobante o factura** por lo que te paguen, según las reglas de tu país, y guarda los reportes mensuales de cada portal.
5. **Expectativa realista:** en los portales los ingresos dependen de cuánta gente juega y cuánto tiempo. Los primeros meses suelen ser modestos. Reinvierte en contenido y en videos cortos para atraer jugadores.

## 5. Para que gane más dinero (siguientes versiones)
- **Más razones para volver:** misiones diarias, una moneda premium con anuncios, eventos de fin de semana y una tabla de récords.
- **Más mapa:** nuevos barrios (Wynwood con grafitis, Little Havana, un puerto), un aeropuerto pequeño y más vehículos (lancha, moto deportiva, helicóptero).
- **Historia corta:** 10–15 misiones con personajes propios.
- **Siguiente nivel gráfico:** el juego está hecho 100% con código, sin modelos 3D externos. Para acercarse al realismo de un juego AAA moderno hacen falta modelos `.glb` profesionales (autos, personas animadas, edificios) y texturas PBR escaneadas. Hay fuentes gratuitas con licencia CC0, como Poly Haven para texturas y cielos HDRI, y modelos comprados con licencia comercial. Con eso Three.js puede verse muy bien, aunque un nivel como el de un juego AAA de consola requiere un equipo grande y un motor como Unreal.
