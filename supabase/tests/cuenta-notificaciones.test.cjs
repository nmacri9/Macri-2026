// node --test supabase/tests/cuenta-notificaciones.test.cjs
// Ejecuta la función TypeScript con Supabase y Firebase simulados, sin red.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('supabase/functions/enviar-notificacion/cuenta.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function escenario(evento, topics) {
  const enviados = new Set();
  const avisos = topics.map((topic, index) => ({ id: index + 1, evento, topic }));
  const usuario = {
    auth: { getUser: async () => ({ data: { user: { id: 'mozo' } } }) },
    from: () => ({ select: () => ({ eq: () => ({
      single: async () => ({ data: { id: 'cuenta', mesa_id: '2', total: 35000.5 } }),
    }) }) }),
  };
  const admin = {
    rpc: async () => ({ data: avisos.filter(aviso => !enviados.has(aviso.id)) }),
    from: () => ({
      update: cambios => ({
        eq: async (_, id) => { if (cambios.enviado_en) enviados.add(id); return {}; },
      }),
      select: () => ({ eq: () => ({
        is: async () => ({ count: avisos.length - enviados.size }),
      }) }),
    }),
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Intl,
    Deno: { env: { get: name => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'admin' : 'usuario' } },
    require: () => ({ createClient: (_, key) => key === 'admin' ? admin : usuario }),
  });
  return enviar => exports.notificarCuenta(new Request('http://local', {
    headers: { Authorization: 'Bearer sesion-simulada' },
  }), 'cuenta', enviar);
}

test('confirmación: dueño y supervisor reciben mesa e importe, cliente conserva su aviso', async () => {
  const notificar = escenario('confirmacion', ['cliente_1', 'duenos', 'supervisores']);
  const mensajes = [];
  const resultado = await notificar(async mensaje => { mensajes.push(mensaje); });
  assert.equal(resultado.pendientes, 0);
  for (const topic of ['duenos', 'supervisores']) {
    const mensaje = mensajes.find(item => item.topic === topic);
    assert.equal(mensaje.notification.title, 'Pago confirmado por el mozo');
    assert.match(mensaje.notification.body, /35\.000,50/);
    assert.match(mensaje.notification.body, /mesa 2/);
    assert.equal(mensaje.data.ruta, '/home');
  }
  assert.equal(mensajes.find(item => item.topic === 'cliente_1').data.ruta, '/cuenta');
});

test('un fallo del supervisor no impide el aviso al dueño y se reintenta solo el pendiente', async () => {
  const notificar = escenario('confirmacion', ['duenos', 'supervisores']);
  const topics = [];
  const resultado = await notificar(async mensaje => {
    topics.push(mensaje.topic);
    if (mensaje.topic === 'supervisores') throw new Error('Firebase no disponible');
  });
  assert.deepEqual(topics, ['duenos', 'supervisores']);
  assert.equal(resultado.pendientes, 1);
  topics.length = 0;
  assert.equal((await notificar(async mensaje => { topics.push(mensaje.topic); })).pendientes, 0);
  assert.deepEqual(topics, ['supervisores']);
});

test('el aviso del pago del cliente sigue indicando que falta la confirmación del mozo', async () => {
  const notificar = escenario('pago', ['duenos', 'supervisores']);
  await notificar(async mensaje => {
    assert.equal(mensaje.notification.title, 'Pago simulado recibido');
    assert.match(mensaje.notification.body, /Pendiente de confirmación/);
  });
});
