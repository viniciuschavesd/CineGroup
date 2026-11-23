
import {
    Component,
    HostListener,
    Input,
    inject
} from '@angular/core';

import { Router } from '@angular/router';

import type { User } from '../../models';

@Component({
    selector: 'app-profile-menu',
    standalone: true,
    templateUrl: './profile-menu.html',
    styleUrl: './profile-menu.css'
})
export class ProfileMenu {

    private router = inject(Router);

    @Input({ required: true }) user!: User;

    isOpen = false;


    // =====================================================
    // INICIAIS DO USUÁRIO
    // =====================================================

    get userInitials(): string {

        if (!this.user?.name) {
            return 'CG';
        }

        return this.user.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0))
            .join('')
            .toUpperCase();

    }


    // =====================================================
    // ABRIR E FECHAR MENU
    // =====================================================

    toggleMenu(event: MouseEvent): void {

        event.stopPropagation();

        this.isOpen = !this.isOpen;

    }


    // Fecha ao clicar fora
    @HostListener('document:click')
    closeMenuOnOutsideClick(): void {

        this.isOpen = false;

    }


    // Fecha com ESC
    @HostListener('document:keydown.escape')
    closeMenuOnEscape(): void {

        this.isOpen = false;

    }


    // =====================================================
    // SAIR DA CONTA
    // =====================================================

    logout(event: MouseEvent): void {

        event.stopPropagation();

        this.isOpen = false;

        // Remove os dados da sessão atual
        sessionStorage.removeItem('cinegroupUser');

        console.log('[Auth] Usuário desconectado.');

        // Volta para o login e substitui a rota atual no histórico
        void this.router.navigateByUrl('/login', {
            replaceUrl: true
        });

    }

}
