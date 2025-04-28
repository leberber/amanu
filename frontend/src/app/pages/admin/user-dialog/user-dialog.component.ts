import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { User } from '../../../models/models'; // make sure User interface is correctly defined

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    DividerModule
  ],
  templateUrl: './user-dialog.component.html',
  styleUrls: ['./user-dialog.component.scss']
})
export class UserDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() user: User | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() update = new EventEmitter<User>();
  @Output() add = new EventEmitter<User>();

  isEditMode:boolean = false;

  userForm: FormGroup = new FormGroup({
    userId: new FormControl(null),
    nom: new FormControl('', Validators.required),
    prenom: new FormControl('', Validators.required),
    email: new FormControl('', [Validators.required, Validators.email]),
    mobile: new FormControl('', Validators.required),
    address: new FormControl('', Validators.required),
    commune: new FormControl('', Validators.required),
    village: new FormControl('', Validators.required),
    wilaya: new FormControl('', Validators.required),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    role: new FormControl('User', Validators.required)
  });

  roleOptions = [
    { label: 'Admin', value: 'Admin' },
    { label: 'User', value: 'User' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (this.visible) {
      this.isEditMode = !!this.user;

      if (this.isEditMode && this.user) {
        const passwordControl = this.userForm.get('password');
        passwordControl?.clearValidators();
        passwordControl?.updateValueAndValidity();

        this.userForm.patchValue({
          userId: this.user.user_id,
          nom: this.user.nom,
          prenom: this.user.prenom,
          email: this.user.email,
          mobile: this.user.mobile,
          address: this.user.address,
          commune: this.user.commune,
          village: this.user.village,
          wilaya: this.user.wilaya,
          role: this.user.role
        });
      } else {
        this.userForm.reset({ role: 'User' });
      }
    }
  }

  hideDialog() {
    this.visible = false;
    this.visibleChange.emit(this.visible);
    this.userForm.reset({ role: 'User' });
  }

  addUser() {
    if (this.userForm.valid) {
      this.add.emit(this.userForm.value);
      this.hideDialog();
    }
  }

  updateUser() {
    if (this.userForm.valid) {
      
      this.update.emit(this.userForm.value);
      this.hideDialog();
    }
  }
}
