
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
import { ProfileMenu } from '../../components/profile-menu/profile-menu';
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
    Group
} from '../../models';

@Component({
    selector: 'app-groups',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ProfileMenu,
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
    // EDIÇÃO DE GRUPOS
    // =====================================================

    isEditGroupModalOpen = false;

    groupBeingEdited: Group | null = null;

    editGroupName = '';
    editGroupDescription = '';

    isSavingGroupChanges = false;
    editGroupError = '';


    // =====================================================
    // EXCLUSÃO DE GRUPOS
    // =====================================================

    groupToDelete: Group | null = null;

    isDeletingGroup = false;

    deleteGroupError = '';


    // =====================================================
    // SAIR DE UM GRUPO
    // =====================================================

    groupToLeave: Group | null = null;

    isLeavingGroup = false;

    leaveGroupError = '';


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

                this.ngZone.run(() => {

                    this.loading = false;
                    this.cdr.detectChanges();

                });

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

                (data.posts ?? []).forEach(post => {

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
                this.ngZone.run(() => {

                    this.lastPostDates.set(latestPostDates);

                    this.cdr.detectChanges();

                });

            },

            error: error => {

                console.error(
                    '[Groups] Erro ao carregar grupos:',
                    error
                );

                this.ngZone.run(() => {

                    this.errorMessage =
                        'Não foi possível carregar seus grupos. Verifique se o JSON Server está funcionando.';

                    this.cdr.detectChanges();

                });

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
    // EDITAR GRUPO
    // =====================================================

    openEditGroupModal(group: Group): void {

        // Somente o dono pode editar
        if (!this.isGroupOwner(group)) {
            return;
        }

        // Guarda o grupo que será editado
        this.groupBeingEdited = group;

        // Preenche os campos com os dados atuais
        this.editGroupName = group.name;
        this.editGroupDescription = group.description ?? '';

        this.editGroupError = '';

        // Abre o modal
        this.isEditGroupModalOpen = true;

        this.cdr.detectChanges();

    }


    closeEditGroupModal(): void {

        // Impede fechar durante o salvamento
        if (this.isSavingGroupChanges) {
            return;
        }

        this.isEditGroupModalOpen = false;

        this.groupBeingEdited = null;

        this.editGroupName = '';
        this.editGroupDescription = '';

        this.editGroupError = '';

    }


    // =====================================================
    // CAMPOS DO FORMULÁRIO DE EDIÇÃO
    // =====================================================

    onEditGroupNameInput(event: Event): void {

        const input = event.target as HTMLInputElement;

        this.editGroupName = input.value;

        this.editGroupError = '';

    }


    onEditGroupDescriptionInput(event: Event): void {

        const input = event.target as HTMLTextAreaElement;

        this.editGroupDescription = input.value;

        this.editGroupError = '';

    }


    // =====================================================
    // SALVAR ALTERAÇÕES DO GRUPO
    // =====================================================

    submitEditGroup(event: Event): void {

        event.preventDefault();

        const group = this.groupBeingEdited;
        const user = this.currentUser;

        if (
            !group ||
            !user ||
            !this.isGroupOwner(group) ||
            this.isSavingGroupChanges
        ) {
            return;
        }

        const name = this.editGroupName.trim();
        const description = this.editGroupDescription.trim();

        // Validação do nome
        if (name.length < 3) {

            this.editGroupError =
                'O nome do grupo precisa ter pelo menos 3 caracteres.';

            return;

        }

        if (name.length > 40) {

            this.editGroupError =
                'O nome do grupo pode ter no máximo 40 caracteres.';

            return;

        }

        // Validação da descrição
        if (description.length > 160) {

            this.editGroupError =
                'A descrição pode ter no máximo 160 caracteres.';

            return;

        }

        this.isSavingGroupChanges = true;
        this.editGroupError = '';

        // Dados que serão atualizados no JSON Server
        // String vazia permite apagar a descrição anterior
        const updatedData: Partial<Group> = {
            name,
            description
        };

        console.log(
            '[Groups] Atualizando grupo:',
            group.id,
            updatedData
        );

        this.groupService.updateGroup(
            group.id,
            updatedData
        ).pipe(

            take(1),

            finalize(() => {

                this.ngZone.run(() => {

                    this.isSavingGroupChanges = false;

                    this.cdr.detectChanges();

                });

            })

        ).subscribe({

            next: updatedGroup => {

                this.ngZone.run(() => {

                    console.log(
                        '[Groups] Grupo atualizado:',
                        updatedGroup
                    );

                    // Atualiza o grupo no Signal
                    this.groups.update(currentGroups =>
                        currentGroups.map(item =>
                            item.id === updatedGroup.id
                                ? updatedGroup
                                : item
                        )
                    );

                    // Fecha o modal
                    this.isEditGroupModalOpen = false;

                    this.groupBeingEdited = null;

                    // Limpa o formulário
                    this.editGroupName = '';
                    this.editGroupDescription = '';
                    this.editGroupError = '';

                    this.cdr.detectChanges();

                });

            },

            error: error => {

                console.error(
                    '[Groups] Erro ao editar grupo:',
                    error
                );

                this.ngZone.run(() => {

                    this.editGroupError =
                        'Não foi possível salvar as alterações. Tente novamente.';

                    this.cdr.detectChanges();

                });

            }

        });

    }


    // =====================================================
    // SAIR DE UM GRUPO
    // =====================================================

    openLeaveGroupConfirmation(group: Group): void {

        const user = this.currentUser;

        // O dono não pode sair do próprio grupo
        if (!user || this.isGroupOwner(group)) {
            return;
        }

        // Verifica se o usuário realmente participa do grupo
        const members = group.memberUserIds ?? [];

        if (!members.includes(user.id)) {
            return;
        }

        this.groupToLeave = group;

        this.leaveGroupError = '';

        this.cdr.detectChanges();

    }


    closeLeaveGroupConfirmation(): void {

        // Impede fechar durante a operação
        if (this.isLeavingGroup) {
            return;
        }

        this.groupToLeave = null;

        this.leaveGroupError = '';

    }


    // =====================================================
    // CONFIRMAR SAÍDA DO GRUPO
    // =====================================================

    confirmLeaveGroup(): void {

        const group = this.groupToLeave;
        const user = this.currentUser;

        if (
            !group ||
            !user ||
            this.isGroupOwner(group) ||
            this.isLeavingGroup
        ) {
            return;
        }

        const currentMembers = group.memberUserIds ?? [];

        // Confere se o usuário ainda está no grupo
        if (!currentMembers.includes(user.id)) {

            this.leaveGroupError =
                'Você não faz mais parte deste grupo.';

            return;

        }

        // Remove somente o usuário atual
        const updatedMemberIds = currentMembers.filter(
            memberId => memberId !== user.id
        );

        this.isLeavingGroup = true;
        this.leaveGroupError = '';

        console.log(
            '[Groups] Saindo do grupo:',
            group.name
        );

        // Atualiza somente os membros no JSON Server
        this.groupService.updateGroup(
            group.id,
            {
                memberUserIds: updatedMemberIds
            }
        ).pipe(

            take(1),

            finalize(() => {

                this.ngZone.run(() => {

                    this.isLeavingGroup = false;

                    this.cdr.detectChanges();

                });

            })

        ).subscribe({

            next: updatedGroup => {

                this.ngZone.run(() => {

                    console.log(
                        '[Groups] Você saiu do grupo:',
                        updatedGroup
                    );

                    // Remove o card do usuário atual
                    this.groups.update(currentGroups =>
                        currentGroups.filter(
                            item => item.id !== updatedGroup.id
                        )
                    );

                    // Fecha o modal
                    this.groupToLeave = null;

                    this.leaveGroupError = '';

                    this.cdr.detectChanges();

                });

            },

            error: error => {

                console.error(
                    '[Groups] Erro ao sair do grupo:',
                    error
                );

                this.ngZone.run(() => {

                    this.leaveGroupError =
                        'Não foi possível sair do grupo. Verifique sua conexão e tente novamente.';

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
    // VERIFICAÇÃO DE PROPRIEDADE DO GRUPO
    // =====================================================

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

        this.cdr.detectChanges();

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
