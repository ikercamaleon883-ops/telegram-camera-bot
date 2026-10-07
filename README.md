# Bot de Telegram + cámara con consentimiento

## Qué hace

1. El usuario abre el bot y pulsa `/start`.
2. El bot genera un enlace único.
3. El usuario abre el enlace.
4. La página explica que necesita acceso a la cámara.
5. El usuario pulsa «Activar cámara» y acepta el permiso del navegador.
6. El usuario pulsa «Tomar foto».
7. La foto se envía al chat de Telegram asociado al enlace.
8. El enlace queda invalidado después de una captura.

La cámara NO se activa automáticamente y el proyecto no intenta saltarse los permisos del navegador.

## Instalación

Necesitas Node.js 20 o superior.

```bash
npm install
```

Copia `.env.example` como `.env`:

```bash
cp .env.example .env
```

Edita `.env` y pon el token que te entrega @BotFather:

```env
BOT_TOKEN=123456:ABC...
PUBLIC_URL=https://tu-dominio.com
PORT=3000
SESSION_MINUTES=30
```

Después:

```bash
npm start
```

## HTTPS

Los navegadores normalmente requieren un contexto seguro (HTTPS) para `getUserMedia`.
Por eso debes publicar este servidor detrás de HTTPS, por ejemplo mediante un
reverse proxy como Nginx/Caddy o un servicio de hosting que proporcione HTTPS.

No publiques `BOT_TOKEN` en el HTML ni en JavaScript del navegador.

## Seguridad

- No compartas el token de BotFather.
- Usa HTTPS.
- Las sesiones son temporales.
- Cada enlace permite una sola captura.
- No se almacenan las fotos en disco del servidor; se mantienen en memoria mientras
  se envían a Telegram.
- Si necesitas almacenamiento, autenticación o varios usuarios, añade una base de datos
  y controles de acceso.

## Nota

Este ejemplo está pensado para capturas voluntarias. El navegador y el sistema operativo
pueden mostrar sus propios indicadores de cámara y controles de privacidad.
