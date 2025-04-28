import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { User } from '../../../models/models'; // make sure User interface is correctly defined
import { FileUploadModule } from 'primeng/fileupload';
import { MessageService } from 'primeng/api';
import { FileUploadEvent } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { FileSelectEvent } from 'primeng/fileupload';
import { AvatarModule } from 'primeng/avatar';




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
    DividerModule,
    FileUploadModule,
    ToastModule,
    AvatarModule
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
    role: new FormControl('User', Validators.required),
    profile_picture: new FormControl(''),
  });

  roleOptions = [
    { label: 'Admin', value: 'Admin' },
    { label: 'User', value: 'User' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (this.visible) {

      this.isEditMode = !!this.user;

      if (this.isEditMode && this.user) {
        console.log('This user',this.user);
        console.log('This user',this.user.profilePicture);

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
          role: this.user.role,
          profile_picture: this.user.profilePicture
        });
        this.previewImageUrl = this.user.profilePicture;
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
      this.previewImageUrl = null
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

// Add these properties to your component class
selectedFileName: string | null = null;
previewImageUrl: any | null = null;

onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    this.selectedFileName = file.name;

    // Create a temporary image to get dimensions
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target?.result as string;
      
      img.onload = () => {
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Define max dimensions
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        // Set canvas dimensions and draw resized image
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Get resized image as base64 string
        const resizedImageData = canvas.toDataURL(file.type);
        
        // Update preview and form
        this.previewImageUrl = resizedImageData;
        this.userForm.patchValue({
          profile_picture: resizedImageData
        });
        
        // console.log('Resized image dimensions:', width, 'x', height);
      };
    };
    
    reader.readAsDataURL(file);
  }
}
  
  

  
}
