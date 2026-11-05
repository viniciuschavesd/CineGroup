import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CINEGROUP_ICONS } from '../icons/icons';
import { FormsModule} from '@angular/forms';

@Component({
  selector: 'app-createacc',
  standalone: true,
  imports: [RouterModule, ...CINEGROUP_ICONS, FormsModule],
  templateUrl: './createacc.html',
  styleUrl: './createacc.css'
})

export class CreateAcc {
  user = {
    name: "",
    email: "",
    password: "",
  }

  createAccount() {
  
    localStorage.setItem('cineuser', JSON.stringify(this.user));
    alert("Conta criada com sucesso");
    console.log(this.user);
  }
}

