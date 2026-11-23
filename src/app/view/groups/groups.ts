
import { CommonModule } from '@angular/common';

import {
    Component,
    OnInit,
    ChangeDetectorRef,
    signal,
    NgZone,
    inject
} from '@angular/core';

import { Router, RouterModule } from '@angular/router';

import {
    finalize,
    forkJoin,
    take,
    timeout,
    switchMap,
    throwError
} from 'rxjs';

import { CINEGROUP_ICONS } from '../../icons/icons';
import { UserService } from '../../services/user';
import { GroupService } from '../../services/group';
import { MoviePostService } from '../../services/moviepost';

import type {
    User,
    Group,
    MoviePost
} from '../../models';

@Component({
    selector: 'app-groups',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ...CINEGROUP_ICONS
    ],
    templateUrl: './groups.html',
    styleUrl: './groups.css'
})
export class Groups implements OnInit {

    // =====================================================
    // INJEÇÃO DE DEPENDÊNCIAS
    // =====================================================

    private userService = inject(UserService);
    private groupService = inject(GroupService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private ngZone = inject(NgZone);
    private moviePostService = inject(MoviePostService);


    // =====================================================
    // DADOS DO USUÁRIO E DOS GRUPOS
    // =====================================================

    currentUser: User | null = null;

    // Signal responsável pela atualização automática dos grupos
    groups = signal<Group[]>([]);

    lastPostDates = signal<Record<string, string>>({});

    loading = true;
    errorMessage = '';


    // =====================================================
    // CRIAÇÃO DE GRUPOS
    // =====================================================

    isCreateGroupModalOpen = false;

    newGroupName = '';
    newGroupDescription = '';

    isCreatingGroup = false;
    createGroupError = '';


    // =====================================================
    // ENTRAR EM UM GRUPO
    // =====================================================

    isJoinGroupModalOpen = false;

    inviteCodeInput = '';

    isJoiningGroup = false;
    joinGroupError = '';


    // =====================================================
    // INICIALIZAÇÃO
    // =====================================================

    ngOnInit(): void {
        this.loadGroups();
    }


    // =====================================================
    // SESSÃO DO USUÁRIO
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
    // CARREGAMENTO DOS GRUPOS
    // =====================================================

    loadGroups(): void {

        const userId = this.getSessionUserId();

        if (!userId) {

            this.loading = false;
            this.router.navigate(['/login']);

            return;
        }

        this.loading = true;
        this.errorMessage = '';

        forkJoin({

            user: this.userService.getUserById(userId).pipe(
                take(1)
            ),

            groups: this.groupService.getGroupsByUser(userId).pipe(
                take(1)
            ),

            posts: this.moviePostService.getMoviePosts().pipe(
                take(1)
            )

        }).pipe(

            timeout({ first: 10000 }),

            finalize(() => {

                this.loading = false;
                this.cdr.detectChanges();

            })

        ).subscribe({

            next: data => {

                this.ngZone.run(() => {

                    this.currentUser = {
                        ...data.user,
                        movieList: data.user.movieList ?? []
                    };

                    // Atualiza o Signal dos grupos
                    this.groups.set(data.groups ?? []);

                    console.log(
                        '[Groups] Grupos carregados:',
                        this.groups()
                    );

                    this.cdr.detectChanges();

                });

                // Calcula a data da publicação mais recente de cada grupo
                const latestPostDates: Record<string, string> = {};

                data.posts.forEach(post => {

                    if (!post.groupId || !post.postedAt) {
                        return;
                    }

                    const currentDate = latestPostDates[post.groupId];

                    if (
                        !currentDate ||
                        new Date(post.postedAt).getTime() >
                        new Date(currentDate).getTime()
                    ) {

                        latestPostDates[post.groupId] = post.postedAt;

                    }

                });

                // Atualiza o Signal das datas
                this.lastPostDates.set(latestPostDates);

            },

            error: error => {

                console.error(
                    '[Groups] Erro ao carregar grupos:',
                    error
                );

                this.errorMessage =
                    'Não foi possível carregar seus grupos. Verifique se o JSON Server está funcionando.';

                this.cdr.detectChanges();

            }

        });

    }


    // =====================================================
    // ABRIR E FECHAR MODAL DE CRIAÇÃO
    // =====================================================

    openCreateGroupModal(): void {

        this.newGroupName = '';
        this.newGroupDescription = '';
        this.createGroupError = '';

        this.isCreateGroupModalOpen = true;

        this.cdr.detectChanges();

    }


    closeCreateGroupModal(): void {

        // Impede fechar durante a criação
        if (this.isCreatingGroup) {
            return;
        }

        this.isCreateGroupModalOpen = false;

        this.newGroupName = '';
        this.newGroupDescription = '';
        this.createGroupError = '';

    }


    // =====================================================
    // CAMPOS DO FORMULÁRIO DE CRIAÇÃO
    // =====================================================

    onGroupNameInput(event: Event): void {

        const input = event.target as HTMLInputElement;

        this.newGroupName = input.value;

        this.createGroupError = '';

    }


    onGroupDescriptionInput(event: Event): void {

        const input = event.target as HTMLTextAreaElement;

        this.newGroupDescription = input.value;

        this.createGroupError = '';

    }


    // =====================================================
    // CRIAR GRUPO
    // =====================================================

    submitCreateGroup(event: Event): void {

        event.preventDefault();

        const user = this.currentUser;

        if (!user || this.isCreatingGroup) {
            return;
        }

        const name = this.newGroupName.trim();
        const description = this.newGroupDescription.trim();

        // Validação do nome
        if (name.length < 3) {

            this.createGroupError =
                'O nome do grupo precisa ter pelo menos 3 caracteres.';

            return;

        }

        if (name.length > 40) {

            this.createGroupError =
                'O nome do grupo pode ter no máximo 40 caracteres.';

            return;

        }

        // Prepara os dados do grupo
        const newGroup: Omit<Group, 'id'> = {

            name,

            ...(description ? { description } : {}),

            createdByUserId: user.id,

            // O criador já entra como primeiro membro
            memberUserIds: [user.id],

            createdAt: new Date().toISOString()

        };

        this.isCreatingGroup = true;
        this.createGroupError = '';

        console.log(
            '[Groups] Criando grupo:',
            newGroup
        );

        // Salva no JSON Server
        this.groupService.createGroup(newGroup).pipe(

            take(1),

            finalize(() => {

                this.ngZone.run(() => {

                    this.isCreatingGroup = false;

                    this.cdr.detectChanges();

                });

            })

        ).subscribe({

            next: createdGroup => {

                this.ngZone.run(() => {

                    console.log(
                        '[Groups] Grupo criado:',
                        createdGroup
                    );

                    // Atualiza o Signal sem recarregar a página
                    this.groups.update(currentGroups => [
                        ...currentGroups,
                        createdGroup
                    ]);

                    // Fecha o modal
                    this.isCreateGroupModalOpen = false;

                    // Limpa o formulário
                    this.newGroupName = '';
                    this.newGroupDescription = '';
                    this.createGroupError = '';

                    this.cdr.detectChanges();

                });

            },

            error: error => {

                console.error(
                    '[Groups] Erro ao criar grupo:',
                    error
                );

                this.ngZone.run(() => {

                    this.createGroupError =
                        'Não foi possível criar o grupo. Verifique se o JSON Server está funcionando.';

                    this.cdr.detectChanges();

                });

            }

        });

    }


    // =====================================================
    // ABRIR E FECHAR MODAL DE ENTRADA
    // =====================================================

    openJoinGroupModal(): void {

        this.inviteCodeInput = '';
        this.joinGroupError = '';

        this.isJoinGroupModalOpen = true;

        this.cdr.detectChanges();

    }


    closeJoinGroupModal(): void {

        // Impede fechar durante a entrada no grupo
        if (this.isJoiningGroup) {
            return;
        }

        this.isJoinGroupModalOpen = false;

        this.inviteCodeInput = '';
        this.joinGroupError = '';

    }


    // =====================================================
    // NORMALIZAÇÃO DO CÓDIGO DE CONVITE
    // =====================================================

    private normalizeInviteCode(code: string): string {

        return code
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');

    }


    // =====================================================
    // CAMPO DO CÓDIGO DE CONVITE
    // =====================================================

    onInviteCodeInput(event: Event): void {

        const input = event.target as HTMLInputElement;

        // Remove caracteres inválidos e limita a 10 caracteres
        const normalized = this.normalizeInviteCode(input.value)
            .slice(0, 10);

        // Formata no padrão XXXXX-XXXXX
        this.inviteCodeInput = normalized.length > 5
            ? `${normalized.slice(0, 5)}-${normalized.slice(5)}`
            : normalized;

        this.joinGroupError = '';

    }


    // =====================================================
    // ENTRAR EM UM GRUPO PELO CÓDIGO
    // =====================================================

    submitJoinGroup(event: Event): void {

        event.preventDefault();

        const user = this.currentUser;

        if (!user || this.isJoiningGroup) {
            return;
        }

        const inviteCode = this.normalizeInviteCode(
            this.inviteCodeInput
        );

        // Valida o tamanho do código
        if (inviteCode.length !== 10) {

            this.joinGroupError =
                'Digite um código de convite válido.';

            return;

        }

        this.isJoiningGroup = true;
        this.joinGroupError = '';

        console.log(
            '[Groups] Procurando grupo pelo código:',
            inviteCode
        );

        /*
         * Busca todos os grupos cadastrados.
         *
         * Não podemos usar getGroupsByUser() aqui,
         * pois precisamos encontrar grupos dos quais
         * o usuário ainda não participa.
         */

        this.groupService.getGroups().pipe(

            take(1),

            switchMap(allGroups => {

                // Procura o grupo pelo código de convite
                const foundGroup = allGroups.find(group => {

                    if (!group.inviteCode) {
                        return false;
                    }

                    return this.normalizeInviteCode(group.inviteCode) === inviteCode;

                });

                // Código não encontrado
                if (!foundGroup) {

                    return throwError(
                        () => new Error('INVITE_CODE_NOT_FOUND')
                    );

                }

                const currentMembers = foundGroup.memberUserIds ?? [];

                // Impede o usuário de entrar duas vezes
                if (
                    foundGroup.createdByUserId === user.id ||
                    currentMembers.includes(user.id)
                ) {

                    return throwError(
                        () => new Error('ALREADY_MEMBER')
                    );

                }

                // Adiciona o usuário à lista de membros
                const updatedMemberIds = [
                    ...new Set([
                        ...currentMembers,
                        user.id
                    ])
                ];

                console.log(
                    '[Groups] Entrando no grupo:',
                    foundGroup.name
                );

                // Atualiza o grupo no JSON Server
                return this.groupService.updateGroup(
                    foundGroup.id,
                    {
                        memberUserIds: updatedMemberIds
                    }
                );

            }),

            take(1),

            finalize(() => {

                this.ngZone.run(() => {

                    this.isJoiningGroup = false;

                    this.cdr.detectChanges();

                });

            })

        ).subscribe({

            // Entrada realizada com sucesso
            next: joinedGroup => {

                this.ngZone.run(() => {

                    console.log(
                        '[Groups] Entrada realizada:',
                        joinedGroup
                    );

                    // Atualiza a lista de grupos usando o Signal
                    this.groups.update(currentGroups => {

                        const alreadyExists = currentGroups.some(
                            group => group.id === joinedGroup.id
                        );

                        if (alreadyExists) {

                            return currentGroups.map(group =>
                                group.id === joinedGroup.id
                                    ? joinedGroup
                                    : group
                            );

                        }

                        return [
                            ...currentGroups,
                            joinedGroup
                        ];

                    });

                    // Fecha o modal
                    this.isJoinGroupModalOpen = false;

                    // Limpa os campos
                    this.inviteCodeInput = '';
                    this.joinGroupError = '';

                    this.cdr.detectChanges();

                });

            },

            // Tratamento dos erros
            error: error => {

                console.error(
                    '[Groups] Erro ao entrar no grupo:',
                    error
                );

                this.ngZone.run(() => {

                    if (error?.message === 'INVITE_CODE_NOT_FOUND') {

                        this.joinGroupError =
                            'Código não encontrado. Verifique e tente novamente.';

                    } else if (error?.message === 'ALREADY_MEMBER') {

                        this.joinGroupError =
                            'Você já participa deste grupo.';

                    } else {

                        this.joinGroupError =
                            'Não foi possível entrar no grupo. Verifique sua conexão e tente novamente.';

                    }

                    this.cdr.detectChanges();

                });

            }

        });

    }


    // =====================================================
    // INFORMAÇÕES DA PÁGINA
    // =====================================================

    get totalGroups(): number {

        return this.groups().length;

    }


    // Iniciais do usuário
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


    // Inicial do grupo
    getGroupInitials(name: string): string {

        return name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0))
            .join('')
            .toUpperCase();

    }


    // =====================================================
    // AÇÕES DOS GRUPOS
    // =====================================================

    groupToDelete: Group | null = null;

    isDeletingGroup = false;

    deleteGroupError = '';


    isGroupOwner(group: Group): boolean {

        return group.createdByUserId === this.currentUser?.id;

    }


    // =====================================================
    // ABRIR CONFIRMAÇÃO DE EXCLUSÃO
    // =====================================================

    openDeleteGroupConfirmation(group: Group): void {

        if (!this.isGroupOwner(group)) {
            return;
        }

        this.groupToDelete = group;

        this.deleteGroupError = '';

    }


    // =====================================================
    // FECHAR CONFIRMAÇÃO DE EXCLUSÃO
    // =====================================================

    closeDeleteGroupConfirmation(): void {

        if (this.isDeletingGroup) {
            return;
        }

        this.groupToDelete = null;

        this.deleteGroupError = '';

    }


    // =====================================================
    // EXCLUIR GRUPO
    // =====================================================

    confirmDeleteGroup(): void {

        const group = this.groupToDelete;

        if (
            !group ||
            !this.currentUser ||
            !this.isGroupOwner(group) ||
            this.isDeletingGroup
        ) {
            return;
        }

        this.isDeletingGroup = true;
        this.deleteGroupError = '';

        this.groupService.deleteGroup(group.id).pipe(

            take(1),

            finalize(() => {

                this.ngZone.run(() => {

                    this.isDeletingGroup = false;

                    this.cdr.detectChanges();

                });

            })

        ).subscribe({

            next: () => {

                this.ngZone.run(() => {

                    console.log(
                        '[Groups] Grupo excluído:',
                        group.name
                    );

                    // Remove o grupo do Signal
                    this.groups.update(currentGroups =>
                        currentGroups.filter(
                            item => item.id !== group.id
                        )
                    );

                    // Fecha a confirmação
                    this.groupToDelete = null;

                    this.deleteGroupError = '';

                    this.cdr.detectChanges();

                });

            },

            error: error => {

                console.error(
                    '[Groups] Erro ao excluir grupo:',
                    error
                );

                this.ngZone.run(() => {

                    this.deleteGroupError =
                        'Não foi possível excluir o grupo. Tente novamente.';

                    this.cdr.detectChanges();

                });

            }

        });

    }

}
