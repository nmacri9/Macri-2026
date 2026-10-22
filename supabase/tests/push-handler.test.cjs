// node --test supabase/tests/push-handler.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(
  fs.readFileSync('supabase/functions/enviar-notificacion/index.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function escenario({ secreto, chat, falloSDK, cuentaSinExport = false } = {}) {
  let handler;
  let cargasFirebase = 0;
  const mensajes = [];
  const modules = {
    'https://deno.land/std@0.168.0/http/server.ts': { serve: fn => { handler = fn; } },
    'npm:firebase-admin/app': { getApps: () => [], cert: value => value, initializeApp: () => {} },
    'npm:firebase-admin/messaging': { getMessaging: () => ({ send: async mensaje => {
      mensajes.push(mensaje);
      return 'firebase-message-id';
    } }) },
    './chat.ts': { notificacionChat: async () => chat },
    './cuenta.ts': { notificarCuenta: async (_req, _id, enviar) => {
      await enviar({ topic: 'duenos', notification: { title: 'Pago', body: 'Recibido' } });
      return { pendientes: 0 };
    } },
  };
  if (cuentaSinExport) modules['./cuenta.ts'] = {};
  vm.runInNewContext(compiled, {
    exports: {}, Request, Response,
    console: { log() {}, error() {} },
    Deno: { env: { get: () => secreto } },
    require: name => {
      if (name.startsWith('npm:firebase-admin/')) {
        cargasFirebase++;
        if (falloSDK) throw new Error('SDK no disponible');
      }
      if (!(name in modules)) throw new Error(`Módulo inesperado: ${name}`);
      return modules[name];
    },
  });
  return {
    mensajes, cargas: () => cargasFirebase,
    options: () => handler(new Request('https://local', { method: 'OPTIONS' })),
    post: payload => handler(new Request('https://local', { method: 'POST', body: JSON.stringify(payload) })),
  };
}

const secreto = JSON.stringify({ project_id: 'test', client_email: 'test@example.com', private_key: 'test' });

test('el preflight funciona sin credenciales y sin cargar Firebase', async () => {
  const app = escenario({ falloSDK: true });
  const response = await app.options();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assert.equal(app.cargas(), 0);
});

for (const valor of [undefined, '{', '{}']) {
  test(`credencial inválida (${valor}) devuelve error legible con CORS`, async () => {
    const app = escenario({ secreto: valor });
    const response = await app.post({ topic: 'mozos' });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.match((await response.json()).error, /FIREBASE_SERVICE_ACCOUNT/);
    assert.equal(app.mensajes.length, 0);
  });
}

test('un error al importar Firebase se captura dentro del handler', async () => {
  const response = await escenario({ falloSDK: true }).post({});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'SDK no disponible');
});

test('un despliegue de cuenta sin export no impide arrancar ni enviar otros avisos', async () => {
  const app = escenario({ secreto, cuentaSinExport: true });
  assert.equal((await app.options()).status, 200);
  assert.equal((await app.post({ topic: 'cocina', titulo: 'Pedido' })).status, 200);
  assert.equal(app.mensajes[0].topic, 'cocina');
  const response = await app.post({ cuenta_id: '1' });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /cuenta.ts debe exportar notificarCuenta/);
});

test('el chat usa el destinatario autorizado y conserva la configuración Android', async () => {
  const chat = { topic: 'chat_cliente_123', notification: { title: 'Respuesta', body: 'Mesa 2' },
    data: { ruta: '/chat-cliente', mensaje_id: '1' } };
  const app = escenario({ secreto, chat });
  assert.equal((await app.post({ mensaje_id: '1', topic: 'incorrecto' })).status, 200);
  assert.equal(app.mensajes[0].topic, chat.topic);
  assert.equal(app.mensajes[0].notification.title, 'Respuesta');
  assert.equal(app.mensajes[0].data.ruta, '/chat-cliente');
  assert.equal(app.mensajes[0].android.notification.channelId, 'default');
});

test('mantiene los avisos generales, de cuenta y omite anuncios del chat', async () => {
  const app = escenario({ secreto, chat: null });
  await app.post({ topic: 'cocina', titulo: 'Pedido', cuerpo: 'Nuevo' });
  await app.post({ cuenta_id: '1' });
  await app.post({ mensaje_id: '2' });
  assert.deepEqual(app.mensajes.map(m => m.topic), ['cocina', 'duenos']);
  assert.equal(app.mensajes[0].notification.title, 'Pedido');
});
