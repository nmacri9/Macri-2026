import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, RolUsuario } from './services/auth.service';

export const roleGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const usuario = await authService.obtenerUsuarioActual();

  if (!usuario) {
    return router.createUrlTree(['/login']);
  }

  let perfil: any = null;

  try {
    perfil = await authService.obtenerPerfil();
  } catch (error) {
    console.error('No se pudo obtener el perfil del usuario:', error);
  }

  const rol = normalizarRol(perfil?.rol ?? usuario.user_metadata?.['rol']);
  const rolesPermitidos = route.data?.['roles'] as RolUsuario[] | undefined;

  if (!rolesPermitidos || rolesPermitidos.includes(rol)) {
    return true;
  }

  return router.createUrlTree(['/home']);
};

function normalizarRol(rol: unknown): RolUsuario {
  const rolNormalizado = String(rol ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') as RolUsuario;

  return rolNormalizado;
}
