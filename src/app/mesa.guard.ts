import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { MesasService } from './services/mesas.service';

// Complementa roleGuard; no reemplaza los permisos de la base de datos.
export const mesaGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const mesas = inject(MesasService);
  const router = inject(Router);
  try {
    const perfil = await auth.obtenerPerfil();
    if (route.data?.['permitirMozo'] && perfil?.rol === 'MOZO') {
      return perfil.estado === 'ACTIVO' || router.createUrlTree(['/home']);
    }
    if (!perfil || !['CLIENTE_REGISTRADO', 'CLIENTE_ANONIMO'].includes(perfil.rol)
      || (perfil.rol === 'CLIENTE_REGISTRADO' ? perfil.estado !== 'APROBADO' : perfil.estado !== 'ACTIVO')) {
      return router.createUrlTree(['/home']);
    }
    const asignacion = await mesas.obtenerAsignacionActiva(perfil.id);
    const habilitado = !!asignacion && (route.data?.['requiereEscaneo'] === false || asignacion.vinculada);
    return habilitado || router.createUrlTree(['/cliente-escaneo-mesa']);
  } catch {
    return router.createUrlTree(['/home']);
  }
};
