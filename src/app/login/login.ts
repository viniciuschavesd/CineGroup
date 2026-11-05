import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CINEGROUP_ICONS } from '../icons/icons';
import { FormsModule} from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, ...CINEGROUP_ICONS, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email: string = '';
  password: string = '';

  checkLogin() {
    const user = JSON.parse(localStorage.getItem('cineuser') || '{}');
    
    if (this.email === user.email && this.password === user.password) {
      alert("Login realizado com sucesso!\nBem-vindo(a) " + user.name);
    } else {
      alert("Erro, conta não reconhecida");
    }
  }
}
