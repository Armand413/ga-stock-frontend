export const permissions = [
  { code: 'VOIR_TABLEAU_BORD', label: 'Consulter le tableau de bord' },
  { code: 'GERER_ARTICLES', label: 'Créer, modifier et archiver les articles' },
  { code: 'GERER_STOCK', label: 'Enregistrer les entrées et sorties de stock' },
  { code: 'TRAITER_DEMANDES', label: 'Consulter et traiter toutes les demandes' },
  { code: 'VOIR_MOUVEMENTS', label: 'Consulter tous les mouvements' },
  { code: 'GERER_ALERTES', label: 'Consulter et acquitter les alertes' },
  { code: 'EXPORTER_STOCK', label: 'Exporter le stock en CSV' },
  { code: 'GERER_NOTIFICATIONS', label: 'Consulter et relancer les notifications' },
];
export const sectionPermissions: Record<string, string[]> = {
  'tableau-bord': ['VOIR_TABLEAU_BORD'],
  articles: ['GERER_ARTICLES', 'GERER_STOCK', 'EXPORTER_STOCK'],
  demandes: ['TRAITER_DEMANDES'],
  mouvements: ['VOIR_MOUVEMENTS'],
  alertes: ['GERER_ALERTES'],
  courriels: ['GERER_NOTIFICATIONS'],
  utilisateurs: [],
};
