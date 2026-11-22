import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { TMDB_CONFIG } from '../config/tmdb.config';

import {
  TmdbSearchResponse,
  TmdbMovieDetails
} from '../models/tmdb.model';

@Injectable({
  providedIn: 'root'
})
export class TmdbService {

  private http = inject(HttpClient);

  private readonly baseUrl = TMDB_CONFIG.baseUrl;
  private readonly imageBaseUrl = TMDB_CONFIG.imageBaseUrl;

  /**
   * Pesquisa filmes pelo nome.
   */
  searchMovies(query: string): Observable<TmdbSearchResponse> {

    const params = new HttpParams()
      .set('api_key', TMDB_CONFIG.apiKey)
      .set('query', query)
      .set('language', 'pt-BR')
      .set('include_adult', 'false')
      .set('page', '1');

    return this.http.get<TmdbSearchResponse>(
      `${this.baseUrl}/search/movie`,
      { params }
    );
  }

  /**
   * Busca os detalhes de um filme.
   */
  getMovieDetails(id: number): Observable<TmdbMovieDetails> {

    const params = new HttpParams()
      .set('api_key', TMDB_CONFIG.apiKey)
      .set('language', 'pt-BR')
      .set('append_to_response', 'credits');

    return this.http.get<TmdbMovieDetails>(
      `${this.baseUrl}/movie/${id}`,
      { params }
    );
  }

  /**
   * Monta a URL do pôster.
   */
  getPosterUrl(
    path: string | null,
    size: string = 'w500'
  ): string | null {

    if (!path) {
      return null;
    }

    return `${this.imageBaseUrl}/${size}${path}`;
  }
}