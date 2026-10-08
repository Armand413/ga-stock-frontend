import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth, authInterceptor } from './auth';
import { routes } from '../app.routes';
import { Workspace } from '../pages/workspace';
describe('Permissions déléguées', () => {
  let auth: Auth;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
    auth.user.set({
      id: 1,
      nom: 'Alice',
      identifiant: 'alice',
      email: 'alice@example.test',
      role: 'LECTEUR',
      actif: true,
      origine: 'LOCAL',
      permissions: ['GERER_STOCK'],
    });
  });
  afterEach(() => http.verify());
  it('ouvre seulement les sections autorisées et masque les autres actions', async () => {
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/articles', Workspace);
    http
      .expectOne((r) => r.url === '/api/articles')
      .flush({
        content: [{ id: 1, nom: 'Papier', actif: true, quantite: 5 }],
        page: 0,
        size: 20,
        totalPages: 1,
        totalElements: 1,
      });
    await h.fixture.whenStable();
    h.detectChanges();
    const el = h.routeNativeElement!;
    expect(el.textContent).toContain('Mouvement');
    const edit = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Modifier',
    );
    expect(edit?.hidden).toBe(true);
    expect(el.querySelector('a[href="/utilisateurs"]')).toBeNull();
    expect(el.querySelector('a[href="/articles"]')).not.toBeNull();
  });
  it('refuse une route hors droits', async () => {
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/utilisateurs', Workspace);
    http
      .expectOne((r) => r.url === '/api/catalogue')
      .flush({ content: [], page: 0, size: 20, totalPages: 0, totalElements: 0 });
    expect(TestBed.inject(Router).url).toBe('/catalogue');
  });
  it('enregistre les cases cochées sans changer le rôle', async () => {
    auth.user.update((u) => ({ ...u!, role: 'ADMIN' }));
    const h = await RouterTestingHarness.create();
    const v = await h.navigateByUrl('/utilisateurs', Workspace);
    http
      .expectOne((r) => r.url === '/api/utilisateurs')
      .flush({ content: [], page: 0, size: 20, totalPages: 0, totalElements: 0 });
    v.droits({ id: 3, nom: 'Bob', role: 'LECTEUR', permissions: ['GERER_STOCK'] });
    expect(v.form['GERER_STOCK']).toBe(true);
    v.form['GERER_STOCK'] = false;
    v.form['TRAITER_DEMANDES'] = true;
    h.detectChanges();
    await h.fixture.whenStable();
    expect(h.routeNativeElement?.querySelectorAll('input[type="checkbox"]').length).toBe(8);
    const p = v.save();
    const r = http.expectOne('/api/utilisateurs/3/permissions');
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({ permissions: ['TRAITER_DEMANDES'] });
    r.flush({});
    await Promise.resolve();
    http
      .expectOne((r) => r.url === '/api/utilisateurs')
      .flush({ content: [], page: 0, size: 20, totalPages: 0, totalElements: 0 });
    await p;
  });
});
