import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { Auth } from './core/auth';
import { Login } from './pages/login';
import { Workspace } from './pages/workspace';
const signedIn = () => (inject(Auth).user() ? true : inject(Router).createUrlTree(['/connexion']));
const admin = () =>
  inject(Auth).user()?.role === 'ADMIN' ? true : inject(Router).createUrlTree(['/catalogue']);
export const routes: Routes = [
  { path: 'connexion', component: Login },
  ...['catalogue', 'mes-demandes', 'mes-consommations', 'profil'].map((path) => ({
    path,
    component: Workspace,
    canActivate: [signedIn],
  })),
  ...[
    'tableau-bord',
    'articles',
    'demandes',
    'mouvements',
    'alertes',
    'utilisateurs',
    'courriels',
  ].map((path) => ({ path, component: Workspace, canActivate: [signedIn, admin] })),
  { path: '', redirectTo: 'catalogue', pathMatch: 'full' },
  { path: '**', redirectTo: 'catalogue' },
];
