/**
 * app.config.ts — Configuración centralizada de variables de entorno
 * El operador ?? con string vacío evita el error de TypeScript con parseInt
 */
export const appConfig = {
  db: {
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     parseInt(process.env.DB_PORT ?? '3306', 10),
    name:     process.env.DB_NAME     ?? 'turnopro_db',
    user:     process.env.DB_USER     ?? 'root',
    pass:     process.env.DB_PASS     ?? '',
  },
  jwt: {
    secret: process.env.JWT_SECRET  ?? 'fallback_secret_cambiar_en_produccion',
    expiry: process.env.JWT_EXPIRY  ?? '7d',
  },
  app: {
    port:   parseInt(process.env.PORT ?? '3000', 10),
    url:    process.env.APP_URL      ?? 'http://localhost:5173',
  },
  mail: {
    host:   process.env.MAIL_HOST   ?? 'smtp.gmail.com',
    port:   parseInt(process.env.MAIL_PORT ?? '587', 10),
    user:   process.env.MAIL_USER   ?? '',
    pass:   process.env.MAIL_PASS   ?? '',
    from:   process.env.MAIL_FROM   ?? '"TurnoPro" <tuturnopro@gmail.com>',
  },
  pendingExpiryHours: parseInt(process.env.PENDING_EXPIRY_HOURS ?? '2', 10),
};
