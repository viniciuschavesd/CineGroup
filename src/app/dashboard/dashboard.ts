
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CINEGROUP_ICONS } from '../icons/icons';

import { UserService } from '../services/user';
import { MovieService } from '../services/movie';
import { GroupService } from '../services/group';
import { MoviePostService } from '../services/moviepost';

import type {
  User,
  Movie,
  Group,
  MovieListStatus
} from '../models';

type MovieFilter = 'all' | MovieListStatus;

interface DashboardMovie extends Movie {
  status: MovieListStatus;
  addedAt: string;
  personalRating?: number;
}

interface DashboardGroup extends Group {
  memberCount: number;
  movieCount: number;
  previewPosters: string[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterModule,
    ...CINEGROUP_ICONS
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {

  private userService = inject(UserService);
  private movieService = inject(MovieService);
  private groupService = inject(GroupService);
  private moviePostService = inject(MoviePostService);
  private router = inject(Router);

  currentUser: User | null = null;

  movies: DashboardMovie[] = [];
  groups: DashboardGroup[] = [];

  activeFilter: MovieFilter = 'all';

  loading = true;
  errorMessage = '';
  updatingMovieId: string | null = null;

  ngOnInit(): void {
    this.loadDashboard();
  }

  // Recupera o usuário salvo após o login
  private getSessionUserId(): string | null {
    const savedUser = sessionStorage.getItem('cinegroupUser');

    if (!savedUser) {
      return null;
    }

    try {
      const user = JSON.parse(savedUser) as Partial<User>;
      return user.id ?? null;
    } catch {
      return null;
    }
  }

  // Carrega todas as informações necessárias
  loadDashboard(): void {
    const userId = this.getSessionUserId();

    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      user: this.userService.getUserById(userId),
      catalog: this.movieService.getMovies(),
      groups: this.groupService.getGroupsByUser(userId),
      posts: this.moviePostService.getMoviePosts()
    }).subscribe({

      next: (data) => {
        this.currentUser = data.user;

        // Relaciona os filmes da lista pessoal com o catálogo
        const movieCatalog = new Map(
          data.catalog.map(movie => [movie.id, movie])
        );

        this.movies = (data.user.movieList ?? [])
          .flatMap(entry => {
            const movie = movieCatalog.get(entry.movieId);

            if (!movie) {
              return [];
            }

            return [{
              ...movie,
              status: entry.status,
              addedAt: entry.addedAt,
              personalRating: entry.personalRating
            }];
          });

        // Calcula informações de cada grupo
        this.groups = data.groups.map(group => {

          const groupPosts = data.posts.filter(
            post => post.groupId === group.id
          );

          const previewPosters = [
            ...new Set(
              groupPosts
                .map(post => movieCatalog.get(post.movieId)?.posterUrl)
                .filter((url): url is string => !!url)
            )
          ].slice(0, 3);

          return {
            ...group,
            memberCount: group.memberUserIds?.length ?? 0,
            movieCount: new Set(
              groupPosts.map(post => post.movieId)
            ).size,
            previewPosters
          };
        });

        this.loading = false;
      },

      error: (error) => {
        console.error('Erro ao carregar dashboard:', error);

        this.errorMessage =
          'Não foi possível carregar seus dados. Verifique se o JSON Server está funcionando.';

        this.loading = false;
      }

    });
  }

  // Filtros da lista pessoal
  setFilter(filter: MovieFilter): void {
    this.activeFilter = filter;
  }

  get filteredMovies(): DashboardMovie[] {
    if (this.activeFilter === 'all') {
      return this.movies;
    }

    return this.movies.filter(
      movie => movie.status === this.activeFilter
    );
  }

  get totalMovies(): number {
    return this.movies.length;
  }

  get unwatchedMovies(): number {
    return this.movies.filter(
      movie => movie.status === 'want-to-watch'
    ).length;
  }

  get watchedMovies(): number {
    return this.movies.filter(
      movie => movie.status === 'watched'
    ).length;
  }

  // Alterna entre visto e não visto e salva no JSON Server
  toggleMovieStatus(movie: DashboardMovie): void {
    if (!this.currentUser || this.updatingMovieId) {
      return;
    }

    const nextStatus: MovieListStatus =
      movie.status === 'watched' ? 'want-to-watch' : 'watched';

    const updatedList = (this.currentUser.movieList ?? []).map(entry => {

      if (entry.movieId !== movie.id) {
        return entry;
      }

      return {
        ...entry,
        status: nextStatus,
        watchedAt: nextStatus === 'watched'
          ? new Date().toISOString()
          : undefined
      };
    });

    this.updatingMovieId = movie.id;

    this.userService.updateUser(
      this.currentUser.id,
      { movieList: updatedList }
    ).subscribe({

      next: () => {
        if (!this.currentUser) {
          return;
        }

        this.currentUser = {
          ...this.currentUser,
          movieList: updatedList
        };

        movie.status = nextStatus;

        sessionStorage.setItem(
          'cinegroupUser',
          JSON.stringify(this.currentUser)
        );

        this.updatingMovieId = null;
      },

      error: (error) => {
        console.error('Erro ao atualizar filme:', error);

        this.errorMessage =
          'Não foi possível atualizar o status do filme.';

        this.updatingMovieId = null;
      }

    });
  }

  // Iniciais para o avatar do usuário
  get userInitials(): string {
    if (!this.currentUser?.name) {
      return 'CG';
    }

    return this.currentUser.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  getMovieNumber(index: number): string {
    return String(index + 1).padStart(2, '0');
  }
}
