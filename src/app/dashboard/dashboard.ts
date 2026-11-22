import {
    Component,
    OnInit,
    ChangeDetectorRef,
    inject
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import {
    catchError,
    defaultIfEmpty,
    finalize,
    forkJoin,
    map,
    of,
    switchMap,
    take,
    throwIfEmpty,
    timeout
} from 'rxjs';

import { CINEGROUP_ICONS } from '../icons/icons';

import { UserService } from '../services/user';
import { MovieService } from '../services/movie';
import { GroupService } from '../services/group';
import { MoviePostService } from '../services/moviepost';
import { TmdbService } from '../services/tmdb';
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
    private cdr = inject(ChangeDetectorRef);
    private tmdbService = inject(TmdbService);

    currentUser: User | null = null;

    movies: DashboardMovie[] = [];
    groups: DashboardGroup[] = [];

    activeFilter: MovieFilter = 'all';

    loading = true;
    errorMessage = '';
    updatingMovieId: string | null = null;

    ngOnInit(): void {
        console.log('TESTE 1: Dashboard foi iniciado');
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
            this.loading = false;
            this.router.navigate(['/login']);
            return;
        }

        this.loading = true;
        this.errorMessage = '';
        this.currentUser = null;
        this.movies = [];
        this.groups = [];

        // Primeiro, carrega somente o usuário.
        // O perfil não depende da existência de filmes ou grupos.
        this.userService.getUserById(userId).pipe(

            take(1),
            timeout({ first: 10000 }),

            switchMap(user => {

                const safeUser: User = {
                    ...user,
                    movieList: user.movieList ?? []
                };

                this.currentUser = safeUser;

                // As demais consultas são complementares.
                // Se alguma falhar, utilizamos uma lista vazia.
                return forkJoin({

                    catalog: this.movieService.getMovies().pipe(
                        take(1),
                        timeout({ first: 10000 }),
                        defaultIfEmpty([] as Movie[]),
                        catchError(error => {
                            console.error('[Dashboard] Erro ao buscar filmes:', error);
                            return of([] as Movie[]);
                        })
                    ),

                    groups: this.groupService.getGroupsByUser(userId).pipe(
                        take(1),
                        timeout({ first: 10000 }),
                        defaultIfEmpty([] as Group[]),
                        catchError(error => {
                            console.error('[Dashboard] Erro ao buscar grupos:', error);
                            return of([] as Group[]);
                        })
                    ),

                    posts: this.moviePostService.getMoviePosts().pipe(
                        take(1),
                        timeout({ first: 10000 }),
                        defaultIfEmpty([]),
                        catchError(error => {
                            console.error('[Dashboard] Erro ao buscar publicações:', error);
                            return of([]);
                        })
                    )

                }).pipe(
                    map(data => ({
                        user: safeUser,
                        ...data
                    }))
                );

            }),

            // Encerra o carregamento independentemente do resultado.
            finalize(() => {
                this.loading = false;

                // Força a atualização da interface
                this.cdr.detectChanges();

                console.log('[Dashboard] Carregamento finalizado.');
                console.log('[Dashboard] Loading:', this.loading);
            })

        ).subscribe({

            next: data => {
                try {

                    console.log('[Dashboard] Dados recebidos:', data);

                    const userMovieList = data.user.movieList ?? [];

                    const movieCatalog = new Map(
                        data.catalog.map(movie => [movie.id, movie])
                    );

                    // Lista pessoal do usuário
                    this.movies = userMovieList.flatMap(entry => {

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

                    // Grupos do usuário
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

                    console.log('[Dashboard] Dashboard carregado:', {
                        user: this.currentUser,
                        movies: this.movies,
                        groups: this.groups
                    });

                } catch (error) {

                    console.error('[Dashboard] Erro ao processar dados:', error);

                    this.errorMessage =
                        'Ocorreu um erro ao organizar as informações do dashboard.';
                }
            },

            error: error => {

                console.error('[Dashboard] Erro ao carregar usuário:', error);

                this.errorMessage =
                    'Não foi possível carregar seu perfil. Verifique se o JSON Server está funcionando.';
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
