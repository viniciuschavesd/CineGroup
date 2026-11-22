
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, map, throwError } from 'rxjs';

import {
  User,
  RegisterUserInput,
  LoginCredentials
} from '../models';

// Registro interno do JSON Server.
// A senha existe somente para simular a autenticação.
interface UserRecord extends User {
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:3000/users';

  // Buscar todos os usuários
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  // Buscar usuário pelo ID
  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  // Cadastrar usuário
  register(input: RegisterUserInput): Observable<User> {

    return this.http
      .get<UserRecord[]>(`${this.apiUrl}?email=${encodeURIComponent(input.email)}`)
      .pipe(
        switchMap(users => {

          if (users.length > 0) {
            return throwError(() =>
              new Error('Este e-mail já está cadastrado.')
            );
          }

          const newUser: UserRecord = {
            id: crypto.randomUUID(),
            name: input.name,
            user: input.user,
            email: input.email,
            password: input.password,
            createdAt: new Date().toISOString(),
            movieList: []
          };

          return this.http.post<UserRecord>(
            this.apiUrl,
            newUser
          );
        }),
        map(({ password, ...user }) => user)
      );
  }

  // Login
  login(credentials: LoginCredentials): Observable<User> {

    return this.http
      .get<UserRecord[]>(
        `${this.apiUrl}?user=${encodeURIComponent(credentials.user)}`
      )
      .pipe(
        map(users => {

          const user = users.find(
            item => item.password === credentials.password
          );

          if (!user) {
            throw new Error('Nome de usuário ou senha incorretos.');
          }

          const { password, ...publicUser } = user;

          return publicUser;
        })
      );
  }

  // Atualizar usuário
  updateUser(id: string, data: Partial<User>): Observable<User> {
    return this.http.patch<User>(
      `${this.apiUrl}/${id}`,
      data
    );
  }

  // Excluir usuário
  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`
    );
  }
}
