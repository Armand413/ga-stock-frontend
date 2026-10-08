export interface User {
  permissions?: string[];
  id: number;
  identifiant: string;
  nom: string;
  role: string;
  actif: boolean;
  email: string;
  origine: string;
}
export interface Session {
  accessToken: string;
  expiration: string;
  utilisateur: User;
}
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface Row {
  id: number;
  [key: string]: any;
}
