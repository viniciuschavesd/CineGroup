
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import type { Group } from '../models';

@Injectable({
  providedIn: 'root'
})
export class GroupService {

  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/groups';

  // Buscar todos os grupos
  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(this.apiUrl);
  }

  // Buscar grupo pelo ID
  getGroupById(id: string): Observable<Group> {
    return this.http.get<Group>(`${this.apiUrl}/${id}`);
  }

  // Buscar grupos dos quais o usuário participa
  getGroupsByUser(userId: string): Observable<Group[]> {
    return this.getGroups().pipe(
      map(groups =>
        groups.filter(group =>
          group.createdByUserId === userId ||
          group.memberUserIds.includes(userId)
        )
      )
    );
  }

  // Cadastrar grupo
  createGroup(group: Omit<Group, 'id'>): Observable<Group> {
    const newGroup: Group = {
      ...group,
      id: crypto.randomUUID()
    };

    return this.http.post<Group>(this.apiUrl, newGroup);
  }

  // Atualizar grupo
  updateGroup(
    id: string,
    data: Partial<Omit<Group, 'id'>>
  ): Observable<Group> {
    return this.http.patch<Group>(
      `${this.apiUrl}/${id}`,
      data
    );
  }

  // Excluir grupo
  deleteGroup(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
