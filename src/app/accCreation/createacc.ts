
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { CINEGROUP_ICONS } from '../icons/icons';
import { UserService } from '../services/user';
import type { RegisterUserInput } from '../models';

@Component({
  selector: 'app-createacc',
  standalone: true,
  imports: [
    RouterModule,
    ...CINEGROUP_ICONS,
    FormsModule
  ],
  templateUrl: './createacc.html',
  styleUrl: './createacc.css'
})
export class CreateAcc {

  private userService = inject(UserService);

  user: RegisterUserInput = {
    name: '',
    user: '',
    email: '',
    password: ''
  };

  isSubmitting = false;

  createAccount(): void {

    if (this.isSubmitting) {
      return;
    }

    const userData: RegisterUserInput = {
      name: this.user.name.trim(),
      user: this.user.user.trim(),
      email: this.user.email.trim().toLowerCase(),
      password: this.user.password
    };

    if (!userData.name || !userData.user || !userData.email || !userData.password) {
      alert('Preencha todos os campos.');
      return;
    }

    if (userData.password.length < 8) {
      alert('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    this.isSubmitting = true;

    this.userService.register(userData).subscribe({

      next: (createdUser) => {
        this.isSubmitting = false;

        alert(`Conta criada com sucesso! Bem-vindo(a), ${createdUser.name}.`);

        console.log('Usuário cadastrado:', createdUser);

        // Limpa o formulário após o cadastro
        this.user = {
          name: '',
          user: '',
          email: '',
          password: ''
        };
      },

      error: (error: unknown) => {
        this.isSubmitting = false;

        const message = error instanceof Error
          ? error.message
          : 'Não foi possível criar sua conta. Tente novamente.';

        alert(message);
      }

    });
  }
}
