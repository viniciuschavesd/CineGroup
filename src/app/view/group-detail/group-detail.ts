
import { CommonModule } from '@angular/common';

import {
    Component,
    OnInit,
    ChangeDetectorRef,
    DestroyRef,
    NgZone,
    inject,
    signal
} from '@angular/core';

import {
    ActivatedRoute,
    Router,
    RouterModule
} from '@angular/router';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    finalize,
    forkJoin,
    map,
    of,
    switchMap,
    take,
    throwError,
    timeout,
    Subject
} from 'rxjs';

import { CINEGROUP_ICONS } from '../../icons/icons';

import { UserService } from '../../services/user';
import { GroupService } from '../../services/group';
import { MovieService } from '../../services/movie';
import { MoviePostService } from '../../services/moviepost';
import { TmdbService } from '../../services/tmdb';

import type {
    User,
    Group,
    Movie,
    MoviePost
} from '../../models';

import type {
    TmdbMovie,
    TmdbMovieDetails
} from '../../models/tmdb.model';


// Publicação enriquecida com os dados do filme e autor.
interface GroupPostView {
    post: MoviePost;
    movie: Movie | null;
    author: User | null;
}


@Component({
    selector: 'app-group-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ...CINEGROUP_ICONS
    ],
    templateUrl: './group-detail.html',
    styleUrl: './group-detail.css'
})
export class GroupDetail implements OnInit {

    // =====================================================
    // INJEÇÃO DE DEPENDÊNCIAS
    // =====================================================

    private userService = inject(UserService);
    private groupService = inject(GroupService);
    private movieService = inject(MovieService);
    private moviePostService = inject(MoviePostService);
    private tmdbService = inject(TmdbService);

    private route = inject(ActivatedRoute);
    private router = inject(Router);

    private cdr = inject(ChangeDetectorRef);
    private ngZone = inject(NgZone);
    private destroyRef = inject(DestroyRef);


    // =====================================================
    // DADOS PRINCIPAIS
    // =====================================================

    currentUser: User | null = null;

    group = signal<Group | null>(null);

    members = signal<User[]>([]);

    posts = signal<GroupPostView[]>([]);

    loading = true;
    errorMessage = '';


    // =====================================================
    // PUBLICAÇÃO DE FILMES
    // =====================================================

    isAddPostModalOpen = false;

    newPostComment = '';
    newPostRating = 8;

    isSavingPost = false;
    addPostError = '';


    // =====================================================
    // PESQUISA TMDB
    // =====================================================

    private movieSearchSubject = new Subject<string>();

    movieSearchQuery = '';

    tmdbResults = signal<TmdbMovie[]>([]);

    isSearchingMovies = signal(false);
    movieSearchPerformed = signal(false);
    movieSearchError = signal('');

    selectedTmdbMovie: TmdbMovie | null = null;

    selectedMovieDetails: TmdbMovieDetails | null = null;

    isLoadingMovieDetails = false;


    // =====================================================
    // REMOÇÃO DE MEMBROS
    // =====================================================

    memberToRemove = signal<User | null>(null);

    isRemovingMember = false;
    removeMemberError = '';


    // =====================================================
    // INICIALIZAÇÃO
    // =====================================================

    ngOnInit(): void {
        this.configureMovieSearch();
        this.loadGroup();
    }


    // =====================================================
    // SESSÃO
    // =====================================================

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


    // =====================================================
    // CARREGAR GRUPO
    // =====================================================

    loadGroup(): void {

        const userId = this.getSessionUserId();
        const groupId = this.route.snapshot.paramMap.get('id');

        if (!userId) {
            this.router.navigate(['/login']);
            return;
        }

        if (!groupId) {
            this.router.navigate(['/groups']);
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        this.userService.getUserById(userId).pipe(

            take(1),

            switchMap(user => {

                return this.groupService.getGroupById(groupId).pipe(

                    take(1),


                    switchMap(group => {

                        // O dono também é considerado membro.
                        const memberIds = [
                            ...new Set([
                                group.createdByUserId,
                                ...(group.memberUserIds ?? [])
                            ])
                        ];

                        // Verifica se o usuário participa do grupo.
                        if (!memberIds.includes(userId)) {

                            return throwError(
                                () => new Error('Você não participa deste grupo.')
                            );

                        }

                        // Se já existe código, não gera outro.
                        // Se o usuário for o dono e ainda não existir,
                        // gera e salva automaticamente.
                        const groupWithInviteCode$ = group.inviteCode
                            ? of(group)

                            : group.createdByUserId === userId

                                ? this.groupService.updateGroup(
                                    group.id,
                                    {
                                        inviteCode: this.generateInviteCode()
                                    }
                                ).pipe(

                                    take(1),

                                    catchError(error => {

                                        console.error(
                                            '[GroupDetail] Erro ao gerar código:',
                                            error
                                        );

                                        this.inviteCodeError =
                                            'Não foi possível gerar o código de convite. Tente novamente ao recarregar a página.';

                                        return of(group);

                                    })

                                )

                                : of(group);


                        return groupWithInviteCode$.pipe(

                            switchMap(groupWithInviteCode => {

                                const memberRequests = memberIds.map(id =>

                                    this.userService.getUserById(id).pipe(
                                        take(1),
                                        catchError(() => of(null))
                                    )

                                );

                                const members$ = memberRequests.length
                                    ? forkJoin(memberRequests)
                                    : of([] as (User | null)[]);


                                return forkJoin({

                                    posts: this.moviePostService
                                        .getMoviePostsByGroup(groupId)
                                        .pipe(take(1)),

                                    movies: this.movieService
                                        .getMovies()
                                        .pipe(take(1)),

                                    members: members$

                                }).pipe(

                                    map(data => ({

                                        user,

                                        group: {
                                            ...groupWithInviteCode,
                                            memberUserIds: memberIds
                                        },

                                        ...data

                                    }))

                                );

                            })

                        );

                    })


                );

            }),

            timeout({ first: 15000 }),

            finalize(() => {

                this.ngZone.run(() => {
                    this.loading = false;
                    this.cdr.detectChanges();
                });

            })

        ).subscribe({

            next: data => {

                this.ngZone.run(() => {

                    this.currentUser = data.user;

                    this.group.set(data.group);

                    // Usuários encontrados.
                    const validMembers = data.members.filter(
                        (user): user is User => user !== null
                    );

                    this.members.set(validMembers);

                    // Organiza os filmes por ID.
                    const movieMap = new Map(
                        data.movies.map(movie => [movie.id, movie])
                    );

                    // Organiza os usuários por ID.
                    const userMap = new Map(
                        validMembers.map(user => [user.id, user])
                    );

                    // Monta as publicações com seus dados relacionados.
                    const groupPosts: GroupPostView[] = data.posts

                        .map(post => ({
                            post,
                            movie: movieMap.get(post.movieId) ?? null,
                            author: userMap.get(post.authorUserId) ?? null
                        }))

                        .sort((a, b) =>
                            new Date(b.post.postedAt).getTime() -
                            new Date(a.post.postedAt).getTime()
                        );

                    this.posts.set(groupPosts);

                    console.log('[GroupDetail] Grupo:', this.group());
                    console.log('[GroupDetail] Membros:', this.members());
                    console.log('[GroupDetail] Publicações:', this.posts());

                    this.cdr.detectChanges();

                });

            },

            error: error => {

                console.error('[GroupDetail] Erro:', error);

                this.errorMessage =
                    error.message === 'Você não participa deste grupo.'
                        ? error.message
                        : 'Não foi possível carregar o grupo. Verifique sua conexão e tente novamente.';

            }

        });

    }


    // =====================================================
    // PERMISSÕES
    // =====================================================

    isGroupOwner(): boolean {

        return this.group()?.createdByUserId === this.currentUser?.id;

    }

    canRemoveMember(member: User): boolean {

        return this.isGroupOwner() &&
            member.id !== this.currentUser?.id;

    }


    // =====================================================
    // INICIAIS
    // =====================================================

    getUserInitials(user: User): string {

        return user.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0))
            .join('')
            .toUpperCase();

    }

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


    // =====================================================
    // MODAL DE PUBLICAÇÃO
    // =====================================================

    openAddPostModal(): void {

        this.movieSearchQuery = '';

        this.tmdbResults.set([]);
        this.movieSearchPerformed.set(false);
        this.movieSearchError.set('');

        this.selectedTmdbMovie = null;
        this.selectedMovieDetails = null;

        this.newPostComment = '';
        this.newPostRating = 8;

        this.addPostError = '';

        this.isAddPostModalOpen = true;

    }

    closeAddPostModal(): void {

        if (this.isSavingPost) {
            return;
        }

        this.movieSearchSubject.next('');

        this.isAddPostModalOpen = false;

        this.movieSearchQuery = '';
        this.tmdbResults.set([]);
        this.selectedTmdbMovie = null;
        this.selectedMovieDetails = null;

        this.addPostError = '';

    }


    // =====================================================
    // PESQUISA AUTOMÁTICA DE FILMES
    // =====================================================

    private configureMovieSearch(): void {

        this.movieSearchSubject.pipe(

            map(query => query.trim()),

            debounceTime(400),

            distinctUntilChanged(),

            switchMap(query => {

                if (query.length < 2) {

                    this.tmdbResults.set([]);
                    this.movieSearchPerformed.set(false);
                    this.isSearchingMovies.set(false);
                    this.movieSearchError.set('');

                    return of(null);

                }

                this.isSearchingMovies.set(true);
                this.movieSearchError.set('');

                return this.tmdbService.searchMovies(query).pipe(

                    take(1),

                    catchError(error => {

                        console.error('[GroupDetail] Pesquisa TMDB:', error);

                        this.tmdbResults.set([]);

                        this.movieSearchError.set(
                            'Não foi possível pesquisar os filmes.'
                        );

                        this.movieSearchPerformed.set(true);

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

            this.tmdbResults.set(response.results ?? []);
            this.movieSearchPerformed.set(true);

        });

    }


    onMovieSearchInput(event: Event): void {

        const input = event.target as HTMLInputElement;

        this.movieSearchQuery = input.value;

        this.tmdbResults.set([]);
        this.movieSearchPerformed.set(false);
        this.movieSearchError.set('');

        this.selectedTmdbMovie = null;
        this.selectedMovieDetails = null;

        this.movieSearchSubject.next(this.movieSearchQuery);

    }


    selectMovie(movie: TmdbMovie): void {

        this.selectedTmdbMovie = movie;
        this.selectedMovieDetails = null;

        this.isLoadingMovieDetails = true;

        this.movieSearchError.set('');

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

                console.error('[GroupDetail] Detalhes TMDB:', error);

                this.movieSearchError.set(
                    'Não foi possível carregar os detalhes do filme.'
                );

            }

        });

    }


    getTmdbPosterUrl(path: string | null): string | null {
        return this.tmdbService.getPosterUrl(path);
    }

    getReleaseYear(date: string | null | undefined): string {

        return date
            ? date.slice(0, 4)
            : 'Ano não informado';

    }


    get selectedMovieDirector(): string {

        const crew = this.selectedMovieDetails?.credits?.crew ?? [];

        return crew.find(member => member.job === 'Director')?.name
            ?? 'Não informado';

    }


    get selectedMovieGenres(): string {

        return (this.selectedMovieDetails?.genres ?? [])
            .map(genre => genre.name)
            .join(' · ');

    }


    // =====================================================
    // COMENTÁRIO E AVALIAÇÃO
    // =====================================================

    onCommentInput(event: Event): void {

        this.newPostComment =
            (event.target as HTMLTextAreaElement).value;

        this.addPostError = '';

    }


    onRatingInput(event: Event): void {

        this.newPostRating =
            Number((event.target as HTMLInputElement).value);

    }


    // =====================================================
    // CRIAR PUBLICAÇÃO NO GRUPO
    // =====================================================

    submitPost(): void {

        const user = this.currentUser;
        const group = this.group();
        const details = this.selectedMovieDetails;

        if (!user || !group || !details || this.isSavingPost) {
            return;
        }

        const comment = this.newPostComment.trim();

        if (comment.length < 3) {

            this.addPostError =
                'Escreva um comentário com pelo menos 3 caracteres.';

            return;

        }

        this.isSavingPost = true;
        this.addPostError = '';

        // Primeiro verifica se o filme já existe no catálogo.
        this.movieService.getMovies().pipe(

            take(1),

            switchMap(catalog => {

                const existingMovie = catalog.find(
                    movie => movie.tmdbId === details.id
                );

                if (existingMovie) {
                    return of(existingMovie);
                }

                // Prepara o filme para o catálogo.
                const newMovie: Omit<Movie, 'id'> = {

                    tmdbId: details.id,

                    title: details.title,

                    director: this.selectedMovieDirector,

                    releaseYear: details.release_date
                        ? Number(details.release_date.slice(0, 4))
                        : 0,

                    posterUrl: this.tmdbService.getPosterUrl(
                        details.poster_path
                    ) ?? undefined,

                    genres: details.genres?.map(
                        genre => genre.name
                    ) ?? [],

                    synopsis: details.overview || undefined

                };

                return this.movieService.createMovie(newMovie).pipe(
                    take(1)
                );

            }),

            // Depois cria a publicação.
            switchMap(movie => {

                const newPost: Omit<MoviePost, 'id'> = {

                    groupId: group.id,

                    movieId: movie.id,

                    authorUserId: user.id,

                    postedAt: new Date().toISOString(),

                    comment,

                    rating: this.newPostRating,

                    likedByUserIds: [],

                    dislikedByUserIds: [],

                    watchedByUserIds: [user.id]

                };

                return this.moviePostService.createMoviePost(newPost).pipe(

                    take(1),

                    map(post => ({
                        post,
                        movie
                    }))

                );

            }),

            finalize(() => {

                this.ngZone.run(() => {

                    this.isSavingPost = false;
                    this.cdr.detectChanges();

                });

            })

        ).subscribe({

            next: result => {

                this.ngZone.run(() => {

                    const newView: GroupPostView = {

                        post: result.post,

                        movie: result.movie,

                        author: user

                    };

                    // Atualiza o mural imediatamente.
                    this.posts.update(currentPosts => [
                        newView,
                        ...currentPosts
                    ]);

                    // Atualiza o modal.
                    this.isAddPostModalOpen = false;

                    this.movieSearchSubject.next('');

                    this.movieSearchQuery = '';
                    this.tmdbResults.set([]);

                    this.selectedTmdbMovie = null;
                    this.selectedMovieDetails = null;

                    this.newPostComment = '';
                    this.newPostRating = 8;

                    this.cdr.detectChanges();

                });

            },

            error: error => {

                console.error('[GroupDetail] Erro ao publicar:', error);

                this.addPostError =
                    'Não foi possível publicar seu filme. Verifique o JSON Server e tente novamente.';

            }

        });

    }


    // =====================================================
    // REMOVER MEMBRO
    // =====================================================

    openRemoveMemberConfirmation(member: User): void {

        if (!this.canRemoveMember(member)) {
            return;
        }

        this.memberToRemove.set(member);
        this.removeMemberError = '';

    }


    closeRemoveMemberConfirmation(): void {

        if (this.isRemovingMember) {
            return;
        }

        this.memberToRemove.set(null);
        this.removeMemberError = '';

    }


    confirmRemoveMember(): void {

        const group = this.group();
        const member = this.memberToRemove();

        if (
            !group ||
            !member ||
            !this.isGroupOwner() ||
            !this.canRemoveMember(member) ||
            this.isRemovingMember
        ) {
            return;
        }

        const updatedMemberIds = group.memberUserIds.filter(
            id => id !== member.id
        );

        this.isRemovingMember = true;
        this.removeMemberError = '';

        this.groupService.updateGroup(
            group.id,
            {
                memberUserIds: updatedMemberIds
            }
        ).pipe(

            take(1),

            finalize(() => {

                this.ngZone.run(() => {

                    this.isRemovingMember = false;
                    this.cdr.detectChanges();

                });

            })

        ).subscribe({

            next: updatedGroup => {

                this.ngZone.run(() => {

                    // Atualiza o Signal do grupo.
                    this.group.set(updatedGroup);

                    // Remove o usuário da lateral.
                    this.members.update(currentMembers =>
                        currentMembers.filter(
                            user => user.id !== member.id
                        )
                    );

                    this.memberToRemove.set(null);
                    this.removeMemberError = '';

                    console.log(
                        '[GroupDetail] Membro removido:',
                        member.name
                    );

                    this.cdr.detectChanges();

                });

            },

            error: error => {

                console.error('[GroupDetail] Erro ao remover membro:', error);

                this.removeMemberError =
                    'Não foi possível remover este membro.';

            }

        });

    }


    // =====================================================
    // VOLTAR PARA OS GRUPOS
    // =====================================================

    backToGroups(): void {
        this.router.navigate(['/groups']);
    }
    // =====================================================
    // CÓDIGO DE CONVITE
    // =====================================================

    inviteCodeCopied = false;
    inviteCodeError = '';

    private generateInviteCode(): string {

        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        const values = new Uint8Array(10);

        crypto.getRandomValues(values);

        const code = Array.from(
            values,
            value => characters[value % characters.length]
        ).join('');

        return `${code.slice(0, 5)}-${code.slice(5)}`;
    }

    copyInviteCode(): void {

        const code = this.group()?.inviteCode;

        if (!code) {
            return;
        }

        this.inviteCodeError = '';
        this.inviteCodeCopied = false;

        if (!navigator.clipboard?.writeText) {

            this.inviteCodeError =
                'Não foi possível acessar a área de transferência do navegador.';

            return;
        }

        navigator.clipboard.writeText(code).then(() => {

            this.ngZone.run(() => {

                this.inviteCodeCopied = true;

                this.cdr.detectChanges();

            });

        }).catch(error => {

            console.error('[GroupDetail] Erro ao copiar código:', error);

            this.ngZone.run(() => {

                this.inviteCodeError =
                    'Não foi possível copiar o código.';

                this.cdr.detectChanges();

            });

        });

    }
}
