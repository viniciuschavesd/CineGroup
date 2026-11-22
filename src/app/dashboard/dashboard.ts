
import { CommonModule } from '@angular/common';

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
    throwError,
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
    UserMovieEntry,
    Movie,
    Group,
    MovieListStatus
} from '../models';

import type {
    TmdbMovie,
    TmdbMovieDetails
} from '../models/tmdb.model';

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
        CommonModule,
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

    // Pesquisa de filmes
    isMovieSearchOpen = false;

    movieSearchQuery = '';
    tmdbResults: TmdbMovie[] = [];

    isSearchingMovies = false;
    movieSearchPerformed = false;
    movieSearchError = '';

    // Filme selecionado
    selectedTmdbMovie: TmdbMovie | null = null;
    selectedMovieDetails: TmdbMovieDetails | null = null;

    isLoadingMovieDetails = false;
    isSavingMovie = false;

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

    // Carrega as informações do dashboard
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

        this.userService.getUserById(userId).pipe(

            take(1),
            timeout({ first: 10000 }),

            switchMap(user => {

                const safeUser: User = {
                    ...user,
                    movieList: user.movieList ?? []
                };

                this.currentUser = safeUser;

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

            finalize(() => {
                this.loading = false;
                this.cdr.detectChanges();
            })

        ).subscribe({

            next: data => {
                try {

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

    // =====================================================
    // PESQUISA DE FILMES NA TMDB
    // =====================================================

    openMovieSearch(): void {
        this.movieSearchQuery = '';
        this.tmdbResults = [];

        this.movieSearchPerformed = false;
        this.movieSearchError = '';

        this.selectedTmdbMovie = null;
        this.selectedMovieDetails = null;

        this.isMovieSearchOpen = true;
    }

    closeMovieSearch(): void {
        if (this.isSavingMovie) {
            return;
        }

        this.isMovieSearchOpen = false;
    }

    onMovieSearchInput(event: Event): void {
        const input = event.target as HTMLInputElement;

        this.movieSearchQuery = input.value;

        // Evita manter resultados de uma pesquisa anterior
        this.tmdbResults = [];
        this.movieSearchPerformed = false;

        this.selectedTmdbMovie = null;
        this.selectedMovieDetails = null;

        this.movieSearchError = '';
    }

    searchTmdbMovies(): void {
        const query = this.movieSearchQuery.trim();

        if (query.length < 2) {
            this.movieSearchError =
                'Digite pelo menos dois caracteres para pesquisar.';

            return;
        }

        if (this.isSearchingMovies) {
            return;
        }

        this.isSearchingMovies = true;
        this.movieSearchError = '';
        this.movieSearchPerformed = false;

        this.tmdbResults = [];
        this.selectedTmdbMovie = null;
        this.selectedMovieDetails = null;

        this.tmdbService.searchMovies(query).pipe(

            take(1),

            finalize(() => {
                this.isSearchingMovies = false;
                this.cdr.detectChanges();
            })

        ).subscribe({

            next: response => {
                this.tmdbResults = response.results ?? [];
                this.movieSearchPerformed = true;
            },

            error: error => {
                console.error('[TMDB] Erro na pesquisa:', error);

                this.movieSearchError =
                    'Não foi possível pesquisar os filmes. Verifique sua conexão e tente novamente.';
            }

        });
    }

    // =====================================================
    // SELEÇÃO E DETALHES DO FILME
    // =====================================================

    selectTmdbMovie(movie: TmdbMovie): void {
        this.selectedTmdbMovie = movie;
        this.selectedMovieDetails = null;

        this.movieSearchError = '';
        this.isLoadingMovieDetails = true;

        this.tmdbService.getMovieDetails(movie.id).pipe(

            take(1),

            finalize(() => {
                this.isLoadingMovieDetails = false;
                this.cdr.detectChanges();
            })

        ).subscribe({

            next: details => {
                this.selectedMovieDetails = details;
            },

            error: error => {
                console.error('[TMDB] Erro ao buscar detalhes:', error);

                this.movieSearchError =
                    'Não foi possível carregar os detalhes deste filme.';
            }

        });
    }

    // URL do pôster
    getTmdbPosterUrl(path: string | null): string | null {
        return this.tmdbService.getPosterUrl(path);
    }

    // Ano de lançamento
    getReleaseYear(releaseDate: string | null | undefined): string {
        if (!releaseDate) {
            return 'Ano não informado';
        }

        return releaseDate.slice(0, 4);
    }

    // Diretor do filme selecionado
    get selectedMovieDirector(): string {
        const crew = this.selectedMovieDetails?.credits?.crew ?? [];

        const director = crew.find(
            member => member.job === 'Director'
        );

        return director?.name ?? 'Não informado';
    }

    // Gêneros do filme selecionado
    get selectedMovieGenres(): string {
        const genres = this.selectedMovieDetails?.genres ?? [];

        return genres
            .map(genre => genre.name)
            .join(' · ');
    }

    // Verifica se o filme já está na lista do usuário
    get isSelectedMovieAlreadyInList(): boolean {
        const tmdbId = this.selectedMovieDetails?.id;

        if (!tmdbId) {
            return false;
        }

        return this.movies.some(
            movie => movie.tmdbId === tmdbId
        );
    }

    // =====================================================
    // ADICIONAR FILME À LISTA PESSOAL
    // =====================================================

    addSelectedMovieToList(): void {
        const details = this.selectedMovieDetails;
        const user = this.currentUser;

        if (!details || !user || this.isSavingMovie) {
            return;
        }

        if (this.isSelectedMovieAlreadyInList) {
            this.movieSearchError =
                'Este filme já está na sua lista.';

            return;
        }

        this.isSavingMovie = true;
        this.movieSearchError = '';

        // Primeiro verifica se o filme já existe no catálogo.
        this.movieService.getMovies().pipe(

            take(1),

            switchMap(catalog => {

                const existingMovie = catalog.find(
                    movie => movie.tmdbId === details.id
                );

                // Reutiliza o cadastro existente, se houver.
                if (existingMovie) {
                    return of(existingMovie);
                }

                // Procura o diretor nos créditos da TMDB.
                const director = details.credits?.crew?.find(
                    member => member.job === 'Director'
                )?.name ?? 'Não informado';

                const posterUrl = this.tmdbService.getPosterUrl(
                    details.poster_path
                );

                const newMovie: Omit<Movie, 'id'> = {
                    tmdbId: details.id,
                    title: details.title,
                    director,
                    releaseYear: details.release_date
                        ? Number(details.release_date.slice(0, 4))
                        : 0,
                    posterUrl: posterUrl ?? undefined,
                    genres: details.genres?.map(
                        genre => genre.name
                    ) ?? [],
                    synopsis: details.overview || undefined
                };

                // Cria o filme no catálogo local.
                return this.movieService.createMovie(newMovie).pipe(
                    take(1)
                );
            }),

            // Depois relaciona o filme ao usuário.
            switchMap(movie => {

                const currentUser = this.currentUser;

                if (!currentUser) {
                    return throwError(
                        () => new Error('Sua sessão não está mais disponível.')
                    );
                }

                const currentList = currentUser.movieList ?? [];

                // Verifica novamente para evitar duplicidade.
                const existingEntry = currentList.find(
                    entry => entry.movieId === movie.id
                );

                if (existingEntry) {
                    return of({
                        movie,
                        updatedList: currentList,
                        entry: existingEntry
                    });
                }

                // Nova entrada tipada corretamente
                const newEntry: UserMovieEntry = {
                    movieId: movie.id,
                    status: 'want-to-watch',
                    addedAt: new Date().toISOString()
                };

                const updatedList: UserMovieEntry[] = [
                    ...currentList,
                    newEntry
                ];

                return this.userService.updateUser(
                    currentUser.id,
                    { movieList: updatedList }
                ).pipe(
                    take(1),
                    map(() => ({
                        movie,
                        updatedList,
                        entry: newEntry
                    }))
                );

            }),

            finalize(() => {
                this.isSavingMovie = false;
                this.cdr.detectChanges();
            })

        ).subscribe({

            next: ({ movie, updatedList, entry }) => {

                if (!this.currentUser) {
                    return;
                }

                // Atualiza o usuário em memória.
                this.currentUser = {
                    ...this.currentUser,
                    movieList: updatedList
                };

                // Atualiza a sessão.
                sessionStorage.setItem(
                    'cinegroupUser',
                    JSON.stringify(this.currentUser)
                );

                // Atualiza a lista exibida no dashboard.
                const dashboardMovie: DashboardMovie = {
                    ...movie,
                    status: entry.status,
                    addedAt: entry.addedAt,
                    personalRating: entry.personalRating
                };

                const alreadyDisplayed = this.movies.some(
                    item => item.id === movie.id
                );

                this.movies = alreadyDisplayed
                    ? this.movies.map(item =>
                        item.id === movie.id ? dashboardMovie : item
                    )
                    : [...this.movies, dashboardMovie];

                // Mostra o filme recém-adicionado.
                this.activeFilter = 'all';

                // Fecha a janela de pesquisa.
                this.isMovieSearchOpen = false;
            },

            error: error => {
                console.error('[Dashboard] Erro ao adicionar filme:', error);

                this.movieSearchError =
                    'Não foi possível adicionar o filme. Verifique se o JSON Server está funcionando.';
            }

        });
    }

    // =====================================================
    // FILTROS DA LISTA PESSOAL
    // =====================================================

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

            error: error => {
                console.error('Erro ao atualizar filme:', error);

                this.errorMessage =
                    'Não foi possível atualizar o status do filme.';

                this.updatingMovieId = null;
            }

        });
    }

    // =====================================================
    // USUÁRIO
    // =====================================================

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
