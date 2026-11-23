import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
    Component,
    OnInit,
    ChangeDetectorRef,
    DestroyRef,
    signal,
    NgZone,
    inject
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
    catchError,
    debounceTime,
    defaultIfEmpty,
    distinctUntilChanged,
    finalize,
    forkJoin,
    map,
    of,
    switchMap,
    take,
    throwError,
    timeout,
    timer,
    Subject
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
    private destroyRef = inject(DestroyRef);
    private movieSearchSubject = new Subject<string>();
    private ngZone = inject(NgZone);


    currentUser: User | null = null;

    movies: DashboardMovie[] = [];
    groups: DashboardGroup[] = [];
    addingTmdbMovieId: number | null = null;
    activeFilter: MovieFilter = 'all';

    loading = true;
    errorMessage = '';
    updatingMovieId: string | null = null;
    movieActionError = signal('');

    // Pesquisa de filmes
    isMovieSearchOpen = false;

    movieSearchQuery = '';

    tmdbResults = signal<TmdbMovie[]>([]);

    isSearchingMovies = signal(false);
    movieSearchPerformed = signal(false);
    movieSearchError = signal('');

    // Filme selecionado
    selectedTmdbMovie: TmdbMovie | null = null;
    selectedMovieDetails: TmdbMovieDetails | null = null;

    isLoadingMovieDetails = false;
    isSavingMovie = false;

    ngOnInit(): void {
        this.configureMovieSearch();
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

    // Captura o texto digitado e dispara a pesquisa automática
    onMovieSearchInput(event: Event): void {

        const input = event.target as HTMLInputElement;

        this.movieSearchQuery = input.value;

        // Limpa os resultados anteriores
        this.tmdbResults.set([]);
        this.movieSearchPerformed.set(false);
        this.movieSearchError.set('');

        // Limpa o filme selecionado
        this.selectedTmdbMovie = null;
        this.selectedMovieDetails = null;

        // Envia o texto para a pesquisa automática
        this.movieSearchSubject.next(this.movieSearchQuery);
    }

    private configureMovieSearch(): void {

        this.movieSearchSubject.pipe(

            map(query => query.trim()),
            debounceTime(400),
            distinctUntilChanged(),

            switchMap(query => {

                // Pesquisa vazia ou muito curta
                if (query.length < 2) {

                    this.tmdbResults.set([]);
                    this.movieSearchPerformed.set(false);
                    this.isSearchingMovies.set(false);
                    this.movieSearchError.set('');

                    return of(null);
                }

                // Inicia o carregamento
                this.isSearchingMovies.set(true);
                this.movieSearchError.set('');

                console.log('[TMDB] Pesquisando:', query);

                return this.tmdbService.searchMovies(query).pipe(

                    take(1),

                    catchError(error => {

                        console.error('[TMDB] Erro na pesquisa:', error);

                        this.tmdbResults.set([]);
                        this.movieSearchPerformed.set(true);

                        this.movieSearchError.set(
                            'Não foi possível pesquisar os filmes. Verifique sua conexão e tente novamente.'
                        );

                        return of(null);
                    }),

                    finalize(() => {
                        this.isSearchingMovies.set(false);
                    })

                );

            }),

            takeUntilDestroyed(this.destroyRef)

        ).subscribe(response => {

            if (!response) {
                return;
            }

            console.log('[TMDB] Resultados recebidos:', response.results);

            this.tmdbResults.set(response.results ?? []);
            this.movieSearchPerformed.set(true);

        });
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
    // Verifica se o filme já está na lista pessoal
    isTmdbMovieInList(movie: TmdbMovie): boolean {

        return this.movies.some(
            item => item.tmdbId === movie.id
        );

    }


    // Adiciona diretamente um resultado da pesquisa
    addTmdbMovieToList(movie: TmdbMovie): void {

        if (
            !this.currentUser ||
            this.isSavingMovie ||
            this.addingTmdbMovieId !== null
        ) {
            return;
        }

        if (this.isTmdbMovieInList(movie)) {
            return;
        }

        this.addingTmdbMovieId = movie.id;
        this.movieSearchError.set('');

        this.tmdbService.getMovieDetails(movie.id).pipe(

            take(1),

            finalize(() => {

                this.ngZone.run(() => {
                    this.addingTmdbMovieId = null;
                    this.cdr.detectChanges();
                });

            })

        ).subscribe({

            next: details => {

                this.ngZone.run(() => {

                    this.selectedTmdbMovie = movie;
                    this.selectedMovieDetails = details;

                    // Reutiliza o cadastro já implementado.
                    this.addSelectedMovieToList();

                    this.cdr.detectChanges();

                });

            },

            error: error => {

                console.error(
                    '[TMDB] Erro ao carregar filme para adicionar:',
                    error
                );

                this.ngZone.run(() => {

                    this.movieSearchError.set(
                        'Não foi possível carregar os detalhes do filme.'
                    );

                    this.cdr.detectChanges();

                });

            }

        });
    }

    removeMovieFromList(movie: DashboardMovie): void {

        const user = this.currentUser;

        if (!user || this.updatingMovieId) {
            return;
        }

        const currentList = user.movieList ?? [];

        // Remove somente a referência do filme na lista pessoal.
        const updatedList: UserMovieEntry[] = currentList.filter(
            entry => entry.movieId !== movie.id
        );

        // Verifica se o filme realmente estava na lista.
        if (updatedList.length === currentList.length) {
            return;
        }

        this.updatingMovieId = movie.id;
        this.movieActionError.set('');

        this.userService.updateUser(
            user.id,
            { movieList: updatedList }
        ).pipe(

            take(1),

            finalize(() => {
                this.ngZone.run(() => {
                    this.updatingMovieId = null;
                    this.cdr.detectChanges();
                });
            })

        ).subscribe({

            next: () => {

                this.ngZone.run(() => {

                    if (!this.currentUser) {
                        return;
                    }

                    // Atualiza o usuário
                    this.currentUser = {
                        ...this.currentUser,
                        movieList: updatedList
                    };

                    // Remove o filme da lista exibida
                    this.movies = this.movies.filter(
                        item => item.id !== movie.id
                    );

                    // Atualiza a sessão
                    sessionStorage.setItem(
                        'cinegroupUser',
                        JSON.stringify(this.currentUser)
                    );

                    this.cdr.detectChanges();

                });

            },

            error: error => {

                console.error('[Dashboard] Erro ao remover filme:', error);

                this.ngZone.run(() => {

                    this.movieActionError.set(
                        'Não foi possível remover o filme da sua lista.'
                    );

                    this.cdr.detectChanges();

                });

            }

        });
    }
    // =====================================================
    // PESQUISA DE FILMES NA TMDB
    // =====================================================

    openMovieSearch(): void {

        this.movieSearchQuery = '';

        this.movieSearchSubject.next('');

        this.tmdbResults.set([]);
        this.movieSearchPerformed.set(false);
        this.movieSearchError.set('');

        this.selectedTmdbMovie = null;
        this.selectedMovieDetails = null;

        this.isSearchingMovies.set(false);
        this.isLoadingMovieDetails = false;

        this.isMovieSearchOpen = true;
    }

    closeMovieSearch(): void {

        if (this.isSavingMovie) {
            return;
        }

        this.movieSearchSubject.next('');

        this.movieSearchQuery = '';

        this.tmdbResults.set([]);
        this.movieSearchPerformed.set(false);
        this.movieSearchError.set('');

        this.isMovieSearchOpen = false;
    }


    // =====================================================
    // SELEÇÃO E DETALHES DO FILME
    // =====================================================

    selectTmdbMovie(movie: TmdbMovie): void {
        this.selectedTmdbMovie = movie;
        this.selectedMovieDetails = null;

        this.movieSearchError.set('');
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

                this.movieSearchError.set('Não foi possível carregar os detalhes deste filme.');
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
            this.movieSearchError.set('Este filme já está na sua lista.');

            return;
        }

        this.isSavingMovie = true;
        this.movieSearchError.set('');

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

                this.movieSearchError.set('Não foi possível adicionar o filme. Verifique se o JSON Server está funcionando.');
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

    const user = this.currentUser;

    if (!user || this.updatingMovieId) {
        return;
    }

    const nextStatus: MovieListStatus =
        movie.status === 'watched'
            ? 'want-to-watch'
            : 'watched';

    // Guarda o estado anterior para permitir desfazer em caso de erro.
    const previousUser = user;
    const previousMovies = this.movies;

    // Prepara a nova lista do usuário.
    const updatedList: UserMovieEntry[] = (user.movieList ?? []).map(entry => {

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

    // Prepara a lista atualizada do dashboard.
    const updatedMovies: DashboardMovie[] = this.movies.map(item => {

        if (item.id !== movie.id) {
            return item;
        }

        return {
            ...item,
            status: nextStatus
        };

    });

    // =================================================
    // ATUALIZAÇÃO IMEDIATA DA INTERFACE
    // =================================================

    this.ngZone.run(() => {

        this.updatingMovieId = movie.id;
        this.movieActionError.set('');

        this.currentUser = {
            ...user,
            movieList: updatedList
        };

        // Cria uma nova referência para a lista.
        this.movies = updatedMovies;

        this.cdr.detectChanges();

    });

    // =================================================
    // SALVAMENTO NO JSON SERVER
    // =================================================

    this.userService.updateUser(
        user.id,
        { movieList: updatedList }
    ).pipe(

        take(1),

        finalize(() => {

            this.ngZone.run(() => {
                this.updatingMovieId = null;
                this.cdr.detectChanges();
            });

        })

    ).subscribe({

        next: () => {

            this.ngZone.run(() => {

                // Atualiza a sessão após confirmação do servidor.
                if (this.currentUser) {
                    sessionStorage.setItem(
                        'cinegroupUser',
                        JSON.stringify(this.currentUser)
                    );
                }

                console.log(
                    `[Dashboard] Filme "${movie.title}" atualizado para:`,
                    nextStatus
                );

                this.cdr.detectChanges();

            });

        },

        error: error => {

            console.error(
                '[Dashboard] Erro ao atualizar filme:',
                error
            );

            // Restaura os dados anteriores.
            this.ngZone.run(() => {

                this.currentUser = previousUser;
                this.movies = previousMovies;

                this.movieActionError.set(
                    'Não foi possível atualizar o status do filme. A alteração foi desfeita.'
                );

                this.cdr.detectChanges();

            });

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
