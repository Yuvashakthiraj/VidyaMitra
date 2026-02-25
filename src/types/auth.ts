
export interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  name?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  signup: (credentials: LoginCredentials) => Promise<User>;
  logout: () => void;
}
