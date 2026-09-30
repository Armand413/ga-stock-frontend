import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, errorMessage } from '../core/auth';
@Component({
  imports: [FormsModule],
  template: `<div class="login-layout">
    <section class="login-story">
      <a class="brand">GA<span>GESTION DES CONSOMMABLES</span></a>
      <div>
        <p class="eyebrow">VOTRE ESPACE ENTREPRISE</p>
        <h1>Le bon matériel.<br />Au bon moment.</h1>
        <p>Un espace commun pour demander vos consommables et suivre chaque distribution.</p>
      </div>
      <small>GA Burkina · Gestion de stock</small>
    </section>
    <main class="login-form">
      <div class="login-card">
        <p class="eyebrow">BIENVENUE</p>
        <h2>Connectez-vous</h2>
        <p class="muted">Utilisez les identifiants de votre compte entreprise.</p>
        <form #f="ngForm" (ngSubmit)="submit()">
          <label
            >Identifiant entreprise<input
              name="identifiant"
              [(ngModel)]="identifiant"
              required
              maxlength="254"
              autocomplete="username"
              placeholder="prenom.nom ou nom@domaine" /></label
          ><label
            >Mot de passe<input
              name="password"
              [(ngModel)]="password"
              required
              maxlength="1024"
              type="password"
              autocomplete="current-password"
          /></label>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <button class="primary wide" [disabled]="f.invalid || busy()">
            {{ busy() ? 'Connexion…' : 'Se connecter →' }}
          </button>
        </form>
        <p class="footnote">
          Votre compte et vos droits d’accès sont gérés par votre entreprise. En cas de difficulté,
          contactez votre administrateur.
        </p>
      </div>
    </main>
  </div>`,
})
export class Login {
  auth = inject(Auth);
  router = inject(Router);
  identifiant = '';
  password = '';
  busy = signal(false);
  error = signal('');
  async submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.identifiant.trim(), this.password);
      this.password = '';
      await this.router.navigateByUrl(
        this.auth.user()?.role === 'ADMIN' ? '/tableau-bord' : '/catalogue',
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
