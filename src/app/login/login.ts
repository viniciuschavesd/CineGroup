
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { CINEGROUP_ICONS } from '../icons/icons';
import { UserService } from '../services/user';
import type { LoginCredentials } from '../models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    RouterModule,
    ...CINEGROUP_ICONS,
    FormsModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  private userService = inject(UserService);
  private router = inject(Router);

  user: string = '';
  password: string = '';

  isSubmitting = false;

  checkLogin(): void {

    if (this.isSubmitting) {
      return;
    }

    const credentials: LoginCredentials = {
      user: this.user.trim(),
      password: this.password
    };

    if (!credentials.user || !credentials.password) {
      alert('Informe seu nome de usuário e sua senha.');
      return;
    }

    this.isSubmitting = true;

    this.userService.login(credentials).subscribe({

      next: (loggedUser) => {
        this.isSubmitting = false;

        // Guarda somente os dados públicos do usuário.
        // A senha não é armazenada nesta sessão.
        sessionStorage.setItem(
          'cinegroupUser',
          JSON.stringify(loggedUser)
        );

       this.router.navigate(['/dashboard']);
      },

      error: (error: unknown) => {
        this.isSubmitting = false;

        const message = error instanceof Error
          ? error.message
          : 'Não foi possível realizar o login. Tente novamente.';

        alert(message);
      }

    });
  }
}
