import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { Administration } from './features/administration/administration';
import { ChangePassword } from './features/home/change-password';
import { Home } from './features/home/home';
import { Login } from './features/login/login';
import { Recovery } from './features/recovery/recovery';
import { ResetPassword } from './features/recovery/reset-password';
import { peopleGuard } from './features/people/people.guard';

export const routes: Routes = [
  {
    path: 'personas',
    loadComponent: () => import('./features/people/people').then((m) => m.People),
    canActivate: [authGuard, peopleGuard],
    title: 'Personas · ProtecEdu',
  },
  { path: 'ingresar', component: Login, title: 'Ingresar · ProtecEdu' },
  { path: 'recuperar', component: Recovery, title: 'Recuperar acceso · ProtecEdu' },
  { path: 'restablecer', component: ResetPassword, title: 'Nueva contraseña · ProtecEdu' },
  { path: 'inicio', component: Home, canActivate: [authGuard], title: 'Inicio · ProtecEdu' },
  {
    path: 'administracion',
    component: Administration,
    canActivate: [authGuard],
    title: 'Administración · ProtecEdu',
  },
  {
    path: 'cambiar-contrasena',
    component: ChangePassword,
    canActivate: [authGuard],
    title: 'Actualizar contraseña · ProtecEdu',
  },
  { path: '', pathMatch: 'full', redirectTo: 'ingresar' },
  { path: '**', redirectTo: 'ingresar' },
];
