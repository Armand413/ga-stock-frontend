import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { Auth, authInterceptor } from './core/auth';
import { Workspace } from './pages/workspace';
import { Login } from './pages/login';

describe('Parcours et sécurité du frontend', () => {
  let http: HttpTestingController;
  let auth: Auth;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
  });
  afterEach(() => http.verify());
  function session(admin = false) {
    auth.token = 'test-token';
    auth.user.set({
      id: 1,
      identifiant: 'alice',
      nom: 'Alice',
      email: 'alice@example.test',
      role: admin ? 'ADMIN' : 'LECTEUR',
      actif: true,
      origine: 'AD',
    });
  }
  function page(content: any[] = [], page = 0, totalPages = 1) {
    return { content, page, size: 20, totalPages, totalElements: content.length };
  }
  async function screen(path: string, admin = false) {
    session(admin);
    const harness = await RouterTestingHarness.create();
    const view = await harness.navigateByUrl('/' + path, Workspace);
    http.expectOne((r) => r.url === '/api/' + path).flush(page());
    await harness.fixture.whenStable();
    return { harness, view };
  }
  it('redirige un visiteur non connecté vers la connexion', async () => {
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/articles', Login);
    expect(TestBed.inject(Router).url).toBe('/connexion');
  });
  it('interdit les écrans administrateur à un utilisateur', async () => {
    session();
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/articles', Workspace);
    http.expectOne((r) => r.url === '/api/catalogue').flush(page());
    expect(TestBed.inject(Router).url).toBe('/catalogue');
    expect(h.routeNativeElement?.textContent).not.toContain('ADMINISTRATION');
  });
  it('connecte un utilisateur avec les identifiants et conserve seulement la session en mémoire', async () => {
    const p = auth.login('alice', 'secret');
    const req = http.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ identifiant: 'alice', motDePasse: 'secret' });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({
      accessToken: 'opaque',
      expiration: '2099-01-01T00:00:00Z',
      utilisateur: { id: 1, nom: 'Alice', role: 'LECTEUR' },
    });
    await p;
    expect(auth.token).toBe('opaque');
    expect(auth.user()?.nom).toBe('Alice');
  });
  it('envoie le bearer et efface une session expirée', async () => {
    session();
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/catalogue', Workspace);
    const r = http.expectOne((x) => x.url === '/api/catalogue');
    expect(r.request.headers.get('Authorization')).toBe('Bearer test-token');
    r.flush({}, { status: 401, statusText: 'Unauthorized' });
    await h.fixture.whenStable();
    expect(auth.user()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/connexion');
  });
  it('crée une demande sans transmettre une identité choisie par le client', async () => {
    const { view } = await screen('catalogue');
    view.newRequest({ id: 8, nom: 'Papier', unite: 'rame', disponible: true });
    view.form = { quantite: 3, motif: 'Bureau', demandeurId: 999 };
    const p = view.save();
    const r = http.expectOne('/api/demandes');
    expect(r.request.body).toEqual({ articleId: 8, quantite: 3, motif: 'Bureau' });
    r.flush({ id: 2 });
    await Promise.resolve();
    http.expectOne((r) => r.url === '/api/catalogue').flush(page());
    await p;
    expect(view.modal()).toBe('');
  });
  it('empêche un double envoi pendant une demande en cours', async () => {
    const { view } = await screen('catalogue');
    view.newRequest({ id: 8, nom: 'Papier', unite: 'rame' });
    const first = view.save();
    await view.save();
    const requests = http.match('/api/demandes');
    expect(requests.length).toBe(1);
    requests[0].flush({}, { status: 503, statusText: 'Unavailable' });
    await first;
    expect(view.modal()).not.toBe('');
  });
  it('refuse une quantité fractionnaire avant l’appel serveur', async () => {
    const { view } = await screen('catalogue');
    view.newRequest({ id: 8, nom: 'Papier', unite: 'rame' });
    view.form['quantite'] = 1.5;
    await view.save();
    http.expectNone('/api/demandes');
    expect(view.modalError()).toContain('entiers');
  });
  it('conserve la décision saisie lorsque le stock est insuffisant', async () => {
    const { view } = await screen('demandes', true);
    view.decision({ id: 7, article: 'Papier', quantite: 10 }, true);
    view.form['reponse'] = 'Accord';
    const p = view.save();
    const r = http.expectOne('/api/demandes/7/decision');
    expect(r.request.method).toBe('PATCH');
    expect(r.request.body).toEqual({ statut: 'APPROUVEE', reponse: 'Accord' });
    r.flush({ detail: 'Stock insuffisant.' }, { status: 409, statusText: 'Conflict' });
    await p;
    expect(view.modalError()).toBe('Stock insuffisant.');
    expect(view.form['reponse']).toBe('Accord');
  });
  it('réinitialise la pagination lors du changement de filtre', async () => {
    const { view } = await screen('articles', true);
    view.page = 3;
    view.recherche = 'papier';
    view.stockBas = true;
    const p = view.load(true);
    const r = http.expectOne((r) => r.url === '/api/articles');
    expect(r.request.params.get('page')).toBe('0');
    expect(r.request.params.get('stockBas')).toBe('true');
    r.flush(page());
    await p;
  });
  it('affiche les champs AD non modifiables et conserve le rôle lors de la désactivation', async () => {
    const { view } = await screen('utilisateurs', true);
    view.user({ id: 4, nom: 'Bob', role: 'LECTEUR', origine: 'AD', actif: true });
    expect(view.fields.find((f) => f.key === 'role')?.readonly).toBe(true);
    view.form['actif'] = 'false';
    const p = view.save();
    const r = http.expectOne('/api/utilisateurs/4');
    expect(r.request.body).toEqual({ nom: 'Bob', role: 'LECTEUR', actif: false });
    r.flush({});
    await Promise.resolve();
    http.expectOne((r) => r.url === '/api/utilisateurs').flush(page());
    await p;
  });
  it('relance une notification sans recréer la demande', async () => {
    const { view } = await screen('courriels', true);
    view.confirm({ id: 9 }, 'retry');
    const p = view.save();
    http.expectOne('/api/courriels/9/reessayer').flush(null);
    await Promise.resolve();
    http.expectOne((r) => r.url === '/api/courriels').flush(page());
    await p;
  });
  it('ignore une ancienne réponse de recherche arrivée en retard', async () => {
    const { view } = await screen('catalogue');
    view.recherche = 'ancien';
    const p1 = view.load();
    const old = http.expectOne((r) => r.params.get('recherche') === 'ancien');
    view.recherche = 'récent';
    const p2 = view.load();
    http
      .expectOne((r) => r.params.get('recherche') === 'récent')
      .flush(page([{ id: 2, nom: 'Récent' }]));
    await p2;
    old.flush(page([{ id: 1, nom: 'Ancien' }]));
    await p1;
    expect(view.data().content[0].id).toBe(2);
  });
});

// Vérification des opérations administratives et personnelles restantes.
describe('Opérations de gestion', () => {
  let http: HttpTestingController;
  let auth: Auth;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
    auth.token = 'test';
    auth.user.set({
      id: 1,
      identifiant: 'admin',
      nom: 'Admin',
      email: 'admin@example.test',
      role: 'ADMIN',
      actif: true,
      origine: 'LOCAL',
    });
  });
  afterEach(() => http.verify());
  async function view(path: string) {
    const h = await RouterTestingHarness.create();
    const v = await h.navigateByUrl('/' + path, Workspace);
    http
      .expectOne((r) => r.url === '/api/' + path)
      .flush({ content: [], page: 0, size: 20, totalPages: 0, totalElements: 0 });
    return v;
  }
  async function finish(p: Promise<void>, path: string) {
    await Promise.resolve();
    http
      .expectOne((r) => r.url === '/api/' + path)
      .flush({ content: [], page: 0, size: 20, totalPages: 0, totalElements: 0 });
    await p;
  }
  it('enregistre une sortie avec le bénéficiaire lié à son compte', async () => {
    const v = await view('articles');
    v.movement({ id: 4, nom: 'Stylos' });
    v.form = {
      type: 'SORTIE',
      quantite: 2,
      beneficiaireId: 12,
      beneficiaire: '',
      motif: 'Service comptable',
    };
    const p = v.save();
    const r = http.expectOne('/api/articles/4/mouvements');
    expect(r.request.body).toEqual({
      type: 'SORTIE',
      quantite: 2,
      beneficiaireId: 12,
      beneficiaire: '',
      motif: 'Service comptable',
    });
    r.flush({});
    await finish(p, 'articles');
  });
  it('ne transmet pas de bénéficiaire sur une entrée', async () => {
    const v = await view('articles');
    v.movement({ id: 4, nom: 'Stylos' });
    v.form = {
      type: 'ENTREE',
      quantite: 2,
      beneficiaireId: 12,
      beneficiaire: 'Bob',
      motif: 'Livraison',
    };
    const p = v.save();
    const r = http.expectOne('/api/articles/4/mouvements');
    expect(r.request.body.beneficiaireId).toBeNull();
    expect(r.request.body.beneficiaire).toBeNull();
    r.flush({});
    await finish(p, 'articles');
  });
  it('annule une demande sur la route personnelle autorisée', async () => {
    const v = await view('mes-demandes');
    v.confirm({ id: 5 }, 'cancel');
    const p = v.save();
    const r = http.expectOne('/api/demandes/5/annulation');
    expect(r.request.method).toBe('PATCH');
    r.flush({});
    await finish(p, 'mes-demandes');
  });
  it('acquitte une alerte', async () => {
    const v = await view('alertes');
    v.confirm({ id: 6 }, 'ack');
    const p = v.save();
    const r = http.expectOne('/api/alertes/6/acquittement');
    expect(r.request.method).toBe('PATCH');
    r.flush({});
    await finish(p, 'alertes');
  });
  it('enregistre un article sans transmettre le stock comme champ modifiable', async () => {
    const v = await view('articles');
    v.article({
      id: 6,
      reference: 'PAP',
      nom: 'Papier',
      unite: 'rame',
      seuilAlerte: 5,
      quantite: 100,
    });
    const p = v.save();
    const r = http.expectOne('/api/articles/6');
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual({
      reference: 'PAP',
      nom: 'Papier',
      unite: 'rame',
      seuilAlerte: 5,
    });
    r.flush({});
    await finish(p, 'articles');
  });
  it('archive un article via son état', async () => {
    const v = await view('articles');
    v.confirm({ id: 6, actif: true, quantite: 0 }, 'state');
    const p = v.save();
    const r = http.expectOne('/api/articles/6/etat');
    expect(r.request.body).toEqual({ actif: false });
    r.flush({});
    await finish(p, 'articles');
  });
  it('empêche un changement de mot de passe avec confirmation différente', async () => {
    const v = await view('utilisateurs');
    v.password({ id: 6 });
    v.form = { nouveauMotDePasse: 'secret123', confirmation: 'different' };
    await v.save();
    http.expectNone('/api/utilisateurs/6/password');
    expect(v.modalError()).toContain('ne correspondent pas');
  });
  it('rend les données de chaque liste sans erreur de modèle', async () => {
    const h = await RouterTestingHarness.create();
    for (const path of [
      'catalogue',
      'articles',
      'mes-demandes',
      'demandes',
      'mes-consommations',
      'mouvements',
      'alertes',
      'utilisateurs',
      'courriels',
    ]) {
      await h.navigateByUrl('/' + path, Workspace);
      http
        .expectOne((r) => r.url === '/api/' + path)
        .flush({
          content: [
            {
              id: 1,
              nom: 'Exemple',
              nomArticle: 'Exemple',
              article: 'Exemple',
              reference: 'EX',
              unite: 'pièce',
              quantite: 2,
              seuilAlerte: 3,
              actif: true,
              disponible: true,
              statut: 'EN_ATTENTE',
              type: 'SORTIE',
              origine: 'AD',
              role: 'LECTEUR',
              creeLe: '2026-09-28T10:00:00Z',
              date: '2026-09-28T10:00:00Z',
              tentatives: 0,
            },
          ],
          page: 0,
          size: 20,
          totalPages: 1,
          totalElements: 1,
        });
      await h.fixture.whenStable();
      h.detectChanges();
      expect(h.routeNativeElement?.querySelectorAll('tbody tr').length).toBe(1);
    }
  });
});
