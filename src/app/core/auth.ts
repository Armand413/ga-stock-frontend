import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { Session, User } from './models';
@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private router = inject(Router);
  user = signal<User | null>(null);
  token = '';
  async login(identifiant: string, motDePasse: string) {
    const s = await firstValueFrom(
      this.http.post<Session>('/api/auth/login', { identifiant, motDePasse }),
    );
    this.token = s.accessToken;
    this.user.set(s.utilisateur);
  }
  async logout() {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.clear();
    }
  }
  clear() {
    this.token = '';
    this.user.set(null);
    void this.router.navigateByUrl('/connexion');
  }
}
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const local = req.url.startsWith('/api/');
  return next(
    local && auth.token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${auth.token}` } })
      : req,
  ).pipe(
    catchError((e) => {
      if (local && e.status === 401 && !req.url.endsWith('/login')) auth.clear();
      return throwError(() => e);
    }),
  );
};
export function errorMessage(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0)
      return 'Le serveur est inaccessible. Vérifiez votre connexion puis réessayez.';
    if (e.status === 401) return 'Identifiants incorrects ou session expirée.';
    if (e.status === 403) return 'Vous ne disposez pas des droits nécessaires.';
    return e.error?.detail || 'L’opération a échoué. Veuillez réessayer.';
  }
  return 'Une erreur est survenue. Veuillez réessayer.';
}
