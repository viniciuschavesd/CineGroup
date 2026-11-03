import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CINEGROUP_ICONS } from '../icons/icons';
import { CreateAcc } from '../accCreation/createacc';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, ...CINEGROUP_ICONS, CreateAcc],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  checkLogin(email, password) {
    if (CreateAcc.user.email == email && this.passwordCheck == password) {
      alert("Account created successfully!");
    } else {
      alert("Please fill in all fields.");
    }
  }
}
