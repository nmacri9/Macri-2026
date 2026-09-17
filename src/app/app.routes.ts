import { Routes } from '@angular/router';
import { roleGuard } from './role.guard';

export const routes: Routes = [
  {
    path: 'menu-productos',
    loadComponent: () => import('./pages/menu-productos/menu-productos.page').then(m => m.MenuProductosPage),
    canActivate: [roleGuard],
    data: { roles: ['CLIENTE_ANONIMO', 'CLIENTE_REGISTRADO'] },
  },
  {
    path: 'chat-cliente',
    loadComponent: () => import('./pages/chat-cliente/chat-cliente.page').then(m => m.ChatClientePage),
    canActivate: [roleGuard],
    data: { roles: ['MOZO', 'CLIENTE_REGISTRADO'] },
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/registro-cliente/registro-cliente.page').then(
        (m) => m.RegistroClientePage
      ),
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    canActivate: [roleGuard],
  },
  {
    path: '',
    redirectTo: 'splash',
    pathMatch: 'full',
  },
  {
    path: 'splash',
    loadComponent: () =>
      import('./pages/splash/splash.page').then((m) => m.SplashPage),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'registro-empleado',
    loadComponent: () =>
      import('./pages/registro-empleado/registro-empleado.page').then(
        (m) => m.RegistroEmpleadoPage
      ),
    canActivate: [roleGuard],
    data: { roles: ['DUENO', 'SUPERVISOR'] },
  },
  {
    path: 'alta-plato',
    loadComponent: () =>
      import('./pages/alta-plato/alta-plato.page').then((m) => m.AltaPlatoPage),
    canActivate: [roleGuard],
    data: { roles: ['DUENO', 'SUPERVISOR', 'COCINERO'] },
  },
  {
    path: 'alta-bebida',
    loadComponent: () =>
      import('./pages/alta-bebida/alta-bebida').then((m) => m.AltaBebidaPage),
    canActivate: [roleGuard],
    data: { roles: ['DUENO', 'SUPERVISOR', 'CANTINERO'] },
  },
  {
    path: 'alta-mesa',
    loadComponent: () =>
      import('./pages/alta-mesa/alta-mesa.page').then((m) => m.AltaMesaPage),
    canActivate: [roleGuard],
    data: { roles: ['DUENO', 'SUPERVISOR'] },
  },
  {
    path: 'registro-cliente',
    loadComponent: () =>
      import('./pages/registro-cliente/registro-cliente.page').then(
        (m) => m.RegistroClientePage
      ),
  },
  {
    path: 'clientes-pendientes',
    loadComponent: () =>
      import('./pages/clientes-pendientes/clientes-pendientes.page').then(
        (m) => m.ClientesPendientesPage
      ),
    canActivate: [roleGuard],
    data: { roles: ['DUENO', 'SUPERVISOR'], requireStoredRole: true },
  },
  {
    path: 'metre-asignacion',
    loadComponent: () =>
      import('./pages/metre-asignacion/metre-asignacion.page').then(
        (m) => m.MetreAsignacionPage
      ),
    canActivate: [roleGuard],
    data: { roles: ['METRE', 'SUPERVISOR', 'DUENO'] },
  },
  {
    path: 'cliente-escaneo-mesa',
    loadComponent: () =>
      import('./pages/cliente-escaneo-mesa/cliente-escaneo-mesa.page').then(
        (m) => m.ClienteEscaneoMesaPage
      ),
    canActivate: [roleGuard],
    data: {
      roles: [
        'CLIENTE_REGISTRADO',
        'CLIENTE_ANONIMO',
        'METRE',
        'SUPERVISOR',
        'DUENO',
      ],
    },
  },
  {
    path: 'registro-anonimo',
    loadComponent: () =>
      import('./pages/registro-anonimo/registro-anonimo.page').then(
        (m) => m.RegistroAnonimoPage
      ),
  },
];
