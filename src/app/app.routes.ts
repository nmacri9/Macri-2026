import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'splash',
    loadComponent: () => import('./pages/splash/splash.page').then( m => m.SplashPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage)
  },
  { 
    path: 'alta-plato',
    loadComponent: () => import('./pages/alta-plato/alta-plato.page').then( m => m.AltaPlatoPage)
  },
  {
    path: 'alta-bebida',
    loadComponent: () => import('./pages/alta-bebida/alta-bebida').then( m => m.AltaBebidaPage)
  },

];
