import { permissions } from '../core/permissions';
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Auth, errorMessage } from '../core/auth';
import { Page, Row } from '../core/models';
interface Field {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  max?: number;
  min?: number;
  options?: { value: string; label: string }[];
  readonly?: boolean;
}
@Component({
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './workspace.html',
})
export class Workspace implements OnInit, OnDestroy {
  auth = inject(Auth);
  http = inject(HttpClient);
  route = inject(ActivatedRoute);
  section = this.route.snapshot.routeConfig?.path || 'catalogue';
  titles: Record<string, string> = {
    'tableau-bord': 'Vue d’ensemble',
    catalogue: 'Catalogue',
    articles: 'Gestion des articles',
    demandes: 'Demandes à traiter',
    'mes-demandes': 'Mes demandes',
    'mes-consommations': 'Mes consommations',
    mouvements: 'Historique des mouvements',
    alertes: 'Alertes de stock',
    utilisateurs: 'Utilisateurs',
    courriels: 'Notifications en attente',
    profil: 'Mon compte',
  };
  personal = [
    ['catalogue', '◇', 'Catalogue'],
    ['mes-demandes', '▤', 'Mes demandes'],
    ['mes-consommations', '↗', 'Mes consommations'],
  ];
  administration = [
    ['tableau-bord', '▦', 'Vue d’ensemble'],
    ['articles', '▣', 'Articles et stock'],
    ['demandes', '▤', 'Toutes les demandes'],
    ['mouvements', '⇄', 'Mouvements'],
    ['alertes', '!', 'Alertes de stock'],
    ['utilisateurs', '◎', 'Utilisateurs'],
    ['courriels', '✉', 'Notifications'],
  ];
  get accessibleAdministration() {
    return this.administration.filter((item) => this.auth.canSection(item[0]));
  }
  droits(row: Row) {
    this.open(
      'Fonctionnalités autorisées pour ' + row['nom'],
      'permissions',
      permissions.map((p) => ({ key: p.code, label: p.label, type: 'checkbox' })),
      Object.fromEntries(
        permissions.map((p) => [p.code, (row['permissions'] || []).includes(p.code)]),
      ),
      row,
    );
  }
  data = signal<Page<Row>>({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  stats = signal<Record<string, number>>({});
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  success = signal('');
  mobile = signal(false);
  page = 0;
  recherche = '';
  statut = '';
  actif = '';
  stockBas = false;
  inclureResolues = false;
  type = '';
  articleId = '';
  debut = '';
  fin = '';
  modal = signal('');
  fields: Field[] = [];
  form: Record<string, any> = {};
  action = '';
  selected: Row | null = null;
  modalError = signal('');
  detail = signal<Row | null>(null);
  private generation = 0;
  private destroyed = false;
  private previousFocus: HTMLElement | null = null;
  get admin() {
    return this.auth.user()?.role === 'ADMIN';
  }
  get title() {
    return this.titles[this.section];
  }
  get requestList() {
    return ['demandes', 'mes-demandes'].includes(this.section);
  }
  get movementList() {
    return ['mouvements', 'mes-consommations'].includes(this.section);
  }
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.generation++;
  }
  label(value: any) {
    const labels: Record<string, string> = {
      EN_ATTENTE: 'En attente',
      APPROUVEE: 'Approuvée',
      REFUSEE: 'Refusée',
      ANNULEE: 'Annulée',
      ENTREE: 'Entrée',
      SORTIE: 'Sortie',
      ADMIN: 'Administrateur',
      LECTEUR: 'Utilisateur',
      GESTIONNAIRE: 'Utilisateur',
    };
    return labels[value] || value;
  }
  filters() {
    let p = new HttpParams().set('page', this.page).set('size', 20);
    if (['articles', 'catalogue'].includes(this.section) && this.recherche.trim())
      p = p.set('recherche', this.recherche.trim());
    if (this.requestList && this.statut) p = p.set('statut', this.statut);
    if (this.section === 'articles') {
      if (this.actif) p = p.set('actif', this.actif);
      p = p.set('stockBas', this.stockBas);
    }
    if (this.section === 'alertes') p = p.set('inclureResolues', this.inclureResolues);
    if (this.section === 'mouvements') {
      if (this.type) p = p.set('type', this.type);
      if (this.articleId) p = p.set('articleId', this.articleId);
      if (this.debut) p = p.set('debut', new Date(this.debut).toISOString());
      if (this.fin) p = p.set('fin', new Date(this.fin).toISOString());
    }
    return p;
  }
  async load(reset = false) {
    if (reset) this.page = 0;
    const version = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.section === 'profil') return;
      if (this.debut && this.fin && this.debut > this.fin) {
        this.error.set('La date de fin doit être postérieure au début.');
        return;
      }
      if (this.section === 'tableau-bord') {
        const v = await firstValueFrom(this.http.get<Record<string, number>>('/api/tableau-bord'));
        if (version === this.generation) this.stats.set(v);
      } else {
        const v = await firstValueFrom(
          this.http.get<Page<Row>>('/api/' + this.section, { params: this.filters() }),
        );
        if (version === this.generation) {
          this.data.set(v);
          if (v.content.length === 0 && this.page > 0) {
            this.page--;
            void this.load();
          }
        }
      }
    } catch (e) {
      if (version === this.generation) this.error.set(errorMessage(e));
    } finally {
      if (version === this.generation) this.loading.set(false);
    }
  }
  async logout() {
    try {
      await this.auth.logout();
    } catch {
      /* Local credentials are cleared even when the server is unavailable. */
    }
  }
  changePage(delta: number) {
    this.page += delta;
    void this.load();
  }
  open(
    title: string,
    action: string,
    fields: Field[],
    form: Record<string, any>,
    row: Row | null = null,
  ) {
    this.previousFocus = document.activeElement as HTMLElement;
    this.action = action;
    this.fields = fields;
    this.form = { ...form };
    this.selected = row;
    this.modalError.set('');
    this.modal.set(title);
    setTimeout(() =>
      document
        .querySelector<HTMLElement>('.dialog input:not([readonly]),.dialog textarea,.dialog button')
        ?.focus(),
    );
  }
  close() {
    if (this.busy()) return;
    this.modal.set('');
    this.detail.set(null);
    this.form = {};
    this.previousFocus?.focus();
  }
  trap(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]',
      ),
    );
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  newRequest(row: Row) {
    this.open(
      'Demander : ' + row['nom'],
      'request',
      [
        {
          key: 'quantite',
          label: 'Quantité demandée (' + row['unite'] + ')',
          type: 'number',
          required: true,
          min: 1,
        },
        { key: 'motif', label: 'Motif de la demande', type: 'textarea', max: 1000 },
      ],
      { quantite: 1, motif: '' },
      row,
    );
  }
  article(row: Row | null = null) {
    this.open(
      row ? 'Modifier l’article' : 'Nouvel article',
      'article',
      [
        { key: 'reference', label: 'Référence', required: true, max: 60 },
        { key: 'nom', label: 'Désignation', required: true, max: 150 },
        { key: 'unite', label: 'Unité (pièce, boîte…)', required: true, max: 40 },
        { key: 'seuilAlerte', label: 'Seuil d’alerte', type: 'number', required: true, min: 0 },
      ],
      row || { reference: '', nom: '', unite: 'pièce', seuilAlerte: 0 },
      row,
    );
  }
  movement(row: Row) {
    this.open(
      'Mouvement : ' + row['nom'],
      'movement',
      [
        {
          key: 'type',
          label: 'Type de mouvement',
          required: true,
          options: [
            { value: 'ENTREE', label: 'Entrée en stock' },
            { value: 'SORTIE', label: 'Sortie de stock' },
          ],
        },
        { key: 'quantite', label: 'Quantité', required: true, type: 'number', min: 1 },
        {
          key: 'beneficiaireId',
          label: 'ID utilisateur bénéficiaire (sortie uniquement)',
          type: 'number',
          min: 1,
        },
        { key: 'beneficiaire', label: 'Nom du bénéficiaire (si sans compte)', max: 150 },
        { key: 'motif', label: 'Motif', type: 'textarea', max: 500 },
      ],
      { type: 'ENTREE', quantite: 1, beneficiaireId: '', beneficiaire: '', motif: '' },
      row,
    );
  }
  decision(row: Row, approved: boolean) {
    this.open(
      approved ? 'Approuver et distribuer' : 'Refuser la demande',
      'decision',
      [
        {
          key: 'reponse',
          label: 'Réponse adressée au demandeur par mail',
          type: 'textarea',
          required: true,
          max: 1000,
        },
      ],
      { statut: approved ? 'APPROUVEE' : 'REFUSEE', reponse: '' },
      row,
    );
  }
  confirm(row: Row, action: string) {
    const titles: Record<string, string> = {
      cancel: 'Annuler cette demande ?',
      state: row['actif'] ? 'Archiver cet article ?' : 'Réactiver cet article ?',
      ack: 'Acquitter cette alerte ?',
      retry: 'Relancer cette notification ?',
    };
    this.open(titles[action], action, [], {}, row);
  }
  user(row: Row | null = null) {
    const local = row?.['origine'] !== 'AD';
    let fields: Field[] = [
      { key: 'nom', label: 'Nom complet', required: true, max: 150, readonly: !local },
      {
        key: 'role',
        label: 'Rôle',
        required: true,
        readonly: !local,
        options: [
          { value: 'LECTEUR', label: 'Utilisateur' },
          { value: 'ADMIN', label: 'Administrateur' },
        ],
      },
    ];
    if (!row)
      fields = [
        {
          key: 'identifiant',
          label: 'Identifiant (3 à 80 lettres, chiffres, . _ -)',
          required: true,
          max: 80,
        },
        { key: 'email', label: 'Adresse mail', type: 'email', max: 254 },
        {
          key: 'motDePasse',
          label: 'Mot de passe local',
          required: true,
          type: 'password',
          min: 6,
          max: 64,
        },
        ...fields,
      ];
    else
      fields.push({
        key: 'actif',
        label: 'Accès à l’application',
        options: [
          { value: 'true', label: 'Activé' },
          { value: 'false', label: 'Désactivé' },
        ],
      });
    this.open(
      row ? 'Modifier l’utilisateur' : 'Créer un compte local',
      'user',
      fields,
      row
        ? { ...row, actif: String(row['actif']) }
        : { nom: '', identifiant: '', email: '', motDePasse: '', role: 'LECTEUR' },
      row,
    );
  }
  password(row: Row | null = null) {
    this.open(
      row ? 'Réinitialiser le mot de passe' : 'Changer mon mot de passe',
      'password',
      [
        ...(!row
          ? [
              {
                key: 'ancienMotDePasse',
                label: 'Mot de passe actuel',
                type: 'password',
                required: true,
                max: 72,
              },
            ]
          : []),
        {
          key: 'nouveauMotDePasse',
          label: 'Nouveau mot de passe (6 caractères minimum)',
          type: 'password',
          required: true,
          min: 6,
          max: 64,
        },
        {
          key: 'confirmation',
          label: 'Confirmer le nouveau mot de passe',
          type: 'password',
          required: true,
          min: 6,
          max: 64,
        },
      ],
      {},
      row,
    );
  }
  async show(row: Row) {
    this.open('Détail de la demande #' + row.id, 'detail', [], {}, row);
    this.busy.set(true);
    try {
      this.detail.set(await firstValueFrom(this.http.get<Row>('/api/demandes/' + row.id)));
    } catch (e) {
      this.modalError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async save() {
    if (this.busy()) return;
    this.modalError.set('');
    for (const f of this.fields) {
      const v = this.form[f.key];
      if (f.required && (v === null || v === undefined || String(v).trim() === '')) {
        this.modalError.set('Renseignez le champ « ' + f.label + ' ».');
        return;
      }
      if (
        f.type === 'number' &&
        v !== '' &&
        v != null &&
        (!Number.isSafeInteger(Number(v)) || Number(v) < (f.min || 0))
      ) {
        this.modalError.set(
          'Les quantités et identifiants doivent être des nombres entiers valides.',
        );
        return;
      }
    }
    if (
      this.action === 'password' &&
      this.form['confirmation'] !== this.form['nouveauMotDePasse']
    ) {
      this.modalError.set('Les mots de passe ne correspondent pas.');
      return;
    }
    if (
      this.action === 'user' &&
      !this.selected &&
      !/^[a-zA-Z0-9._-]{3,80}$/.test(this.form['identifiant'])
    ) {
      this.modalError.set(
        'L’identifiant doit contenir de 3 à 80 lettres, chiffres, points, tirets ou traits de soulignement.',
      );
      return;
    }
    this.busy.set(true);
    let url = '',
      method = 'POST',
      body: Record<string, any> = {};
    const id = this.selected?.id;
    const f = this.form;
    switch (this.action) {
      case 'request':
        url = '/demandes';
        body = { articleId: id, quantite: Number(f['quantite']), motif: f['motif'] };
        break;
      case 'article':
        url = '/articles' + (id ? '/' + id : '');
        method = id ? 'PUT' : 'POST';
        body = {
          reference: f['reference'].trim(),
          nom: f['nom'].trim(),
          unite: f['unite'].trim(),
          seuilAlerte: Number(f['seuilAlerte']),
        };
        break;
      case 'movement':
        url = `/articles/${id}/mouvements`;
        body = {
          type: f['type'],
          quantite: Number(f['quantite']),
          motif: f['motif'],
          beneficiaire: f['type'] === 'SORTIE' ? f['beneficiaire'] : null,
          beneficiaireId:
            f['type'] === 'SORTIE' && f['beneficiaireId'] ? Number(f['beneficiaireId']) : null,
        };
        break;
      case 'decision':
        url = `/demandes/${id}/decision`;
        method = 'PATCH';
        body = { statut: f['statut'], reponse: f['reponse'].trim() };
        break;
      case 'cancel':
        url = `/demandes/${id}/annulation`;
        method = 'PATCH';
        break;
      case 'state':
        url = `/articles/${id}/etat`;
        method = 'PATCH';
        body = { actif: !this.selected?.['actif'] };
        break;
      case 'ack':
        url = `/alertes/${id}/acquittement`;
        method = 'PATCH';
        break;
      case 'retry':
        url = `/courriels/${id}/reessayer`;
        break;
      case 'permissions':
        url = `/utilisateurs/${id}/permissions`;
        method = 'PUT';
        body = { permissions: permissions.filter((p) => f[p.code] === true).map((p) => p.code) };
        break;
      case 'user':
        url = '/utilisateurs' + (id ? '/' + id : '');
        method = id ? 'PUT' : 'POST';
        body = id
          ? { nom: f['nom'], role: f['role'], actif: f['actif'] === 'true' }
          : {
              identifiant: f['identifiant'],
              nom: f['nom'],
              role: f['role'],
              email: f['email'] || null,
              motDePasse: f['motDePasse'],
            };
        break;
      case 'password':
        url = id ? `/utilisateurs/${id}/password` : '/auth/password';
        method = 'PUT';
        body = {
          nouveauMotDePasse: f['nouveauMotDePasse'],
          ...(!id ? { ancienMotDePasse: f['ancienMotDePasse'] } : {}),
        };
        break;
    }
    try {
      await firstValueFrom(this.http.request(method, '/api' + url, { body }));
      this.success.set(
        this.action === 'request' || this.action === 'decision'
          ? 'Demande enregistrée. La notification a été mise en attente d’envoi.'
          : 'Opération enregistrée.',
      );
      this.busy.set(false);
      this.close();
      if (this.action === 'password' && !id) {
        this.auth.clear();
        return;
      }
      if (!this.destroyed) await this.load();
    } catch (e) {
      this.modalError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async export() {
    this.busy.set(true);
    this.error.set('');
    try {
      const blob = await firstValueFrom(
        this.http.get('/api/articles/export', {
          params: this.filters().delete('page').delete('size'),
          responseType: 'blob',
        }),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stock.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
