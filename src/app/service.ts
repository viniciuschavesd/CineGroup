import { Injectable, Service } from '@angular/core';

@Injectable()
export class InjectableService {
  constructor() { }
  user = {
    name: "",
    email: "",
    password: "",
  };
  checkLogin(email, password) {
    if (this.user.email == email && this.user.password == password) {
      alert("Account created successfully!");
    } else {
      alert("Please fill in all fields.");
    }
  }
}
export { Service };



