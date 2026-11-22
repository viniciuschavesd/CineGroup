
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import type { MoviePost } from '../models';

@Injectable({
  providedIn: 'root'
})
export class MoviePostService {

  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/moviePosts';

  // Buscar todas as publicações
  getMoviePosts(): Observable<MoviePost[]> {
    return this.http.get<MoviePost[]>(this.apiUrl);
  }

  // Buscar publicação pelo ID
  getMoviePostById(id: string): Observable<MoviePost> {
    return this.http.get<MoviePost>(`${this.apiUrl}/${id}`);
  }

  // Buscar publicações de um grupo
  getMoviePostsByGroup(groupId: string): Observable<MoviePost[]> {
    return this.http.get<MoviePost[]>(
      `${this.apiUrl}?groupId=${encodeURIComponent(groupId)}`
    );
  }

  // Buscar publicações de um filme
  getMoviePostsByMovie(movieId: string): Observable<MoviePost[]> {
    return this.http.get<MoviePost[]>(
      `${this.apiUrl}?movieId=${encodeURIComponent(movieId)}`
    );
  }

  // Buscar publicações de um usuário
  getMoviePostsByAuthor(userId: string): Observable<MoviePost[]> {
    return this.http.get<MoviePost[]>(
      `${this.apiUrl}?authorUserId=${encodeURIComponent(userId)}`
    );
  }

  // Criar publicação
  createMoviePost(post: Omit<MoviePost, 'id'>): Observable<MoviePost> {
    const newPost: MoviePost = {
      ...post,
      id: crypto.randomUUID()
    };

    return this.http.post<MoviePost>(this.apiUrl, newPost);
  }

  // Atualizar publicação
  updateMoviePost(
    id: string,
    data: Partial<Omit<MoviePost, 'id'>>
  ): Observable<MoviePost> {
    return this.http.patch<MoviePost>(
      `${this.apiUrl}/${id}`,
      data
    );
  }

  // Excluir publicação
  deleteMoviePost(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
