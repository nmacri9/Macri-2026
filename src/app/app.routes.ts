import { Routes } from '@angular/router';
import { roleGuard } from './role.guard';

export const routes: Routes = [
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
        (m) => m.RegistroEmpleadoPage,
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
  },  {
    path: 'registro-cliente',
    loadComponent: () => import('./pages/registro-cliente/registro-cliente.page').then( m => m.RegistroClientePage)
  },

];
