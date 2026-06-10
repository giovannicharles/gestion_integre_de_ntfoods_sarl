import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  profileForm: FormGroup;
  notificationForm: FormGroup;
  securityForm: FormGroup;
  activeTab: string = 'profile';

  constructor(private fb: FormBuilder) {
    this.profileForm = this.fb.group({
      firstName: ['Mvondo', Validators.required],
      lastName: ['Jean-Baptiste', Validators.required],
      email: ['mvondo.jb@tanty.com', [Validators.required, Validators.email]],
      phone: ['+237 6XX XXX XXX', Validators.required],
      role: ['Gestionnaire de Stock', Validators.required]
    });

    this.notificationForm = this.fb.group({
      emailNotifications: [true],
      pushNotifications: [true],
      stockAlerts: [true],
      orderUpdates: [true],
      systemUpdates: [false]
    });

    this.securityForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    });
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  saveProfile(): void {
    if (this.profileForm.valid) {
      console.log('Profile saved:', this.profileForm.value);
      // TODO: Call API to save profile
    }
  }

  saveNotifications(): void {
    console.log('Notifications saved:', this.notificationForm.value);
    // TODO: Call API to save notification preferences
  }

  changePassword(): void {
    if (this.securityForm.valid) {
      const { newPassword, confirmPassword } = this.securityForm.value;
      if (newPassword !== confirmPassword) {
        alert('Les mots de passe ne correspondent pas');
        return;
      }
      console.log('Password changed');
      // TODO: Call API to change password
      this.securityForm.reset();
    }
  }
}
