
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import type { Movie } from '../models';

@Injectable({
  providedIn: 'root'
})
export class MovieService {

  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/movies';

  // Buscar todos os filmes
  getMovies(): Observable<Movie[]> {
    return this.http.get<Movie[]>(this.apiUrl);
  }

  // Buscar filme pelo ID
  getMovieById(id: string): Observable<Movie> {
    return this.http.get<Movie>(`${this.apiUrl}/${id}`);
  }

  // Pesquisar filmes
  searchMovies(search: string): Observable<Movie[]> {
    return this.http.get<Movie[]>(
      `${this.apiUrl}?q=${encodeURIComponent(search)}`
    );
  }

  // Cadastrar filme
  createMovie(movie: Omit<Movie, 'id'>): Observable<Movie> {
    const newMovie: Movie = {
      ...movie,
      id: crypto.randomUUID()
    };

    return this.http.post<Movie>(this.apiUrl, newMovie);
  }

  // Atualizar filme
  updateMovie(
    id: string,
    data: Partial<Omit<Movie, 'id'>>
  ): Observable<Movie> {
    return this.http.patch<Movie>(
      `${this.apiUrl}/${id}`,
      data
    );
  }

  // Excluir filme
  deleteMovie(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
