<template>
  <div class="user-menu">
    <div v-if="!authStore.isAuthenticated" class="auth-buttons">
      <router-link to="/login" class="login-btn">
        Sign In
      </router-link>
    </div>

    <div v-else class="user-info">
      <div class="user-dropdown" @click="toggleDropdown">
        <img 
          v-if="authStore.avatarUrl" 
          :src="authStore.avatarUrl" 
          :alt="authStore.user?.username"
          class="user-avatar"
        />
        <div v-else class="user-avatar-placeholder">
          {{ authStore.user?.username?.[0]?.toUpperCase() }}
        </div>
        <span class="username">{{ authStore.user?.username }}</span>
        <svg class="dropdown-arrow" :class="{ 'rotate': showDropdown }" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </div>

      <div v-if="showDropdown" class="dropdown-menu" @click.stop>
        <div class="dropdown-item user-details">
          <div class="user-name">{{ authStore.user?.username }}</div>
          <div class="user-id">#{{ authStore.user?.discriminator }}</div>
          <div v-if="authStore.isAdmin" class="user-role">Administrator</div>
          <div v-else-if="authStore.user?.role === 'moderator'" class="user-role">Moderator</div>
        </div>
        <hr class="dropdown-divider">
        <router-link 
          v-if="authStore.isAdmin" 
          to="/admin" 
          class="dropdown-item admin-link"
          @click="closeDropdown"
        >
          <svg class="admin-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
          </svg>
          Admin Dashboard
        </router-link>
        <button @click="handleLogout" class="dropdown-item logout-btn">
          <svg class="logout-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>

    <div v-if="showDropdown" class="dropdown-overlay" @click="closeDropdown"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const showDropdown = ref(false)

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

const closeDropdown = () => {
  showDropdown.value = false
}

const handleLogout = async () => {
  await authStore.logout()
  closeDropdown()
}

// Close dropdown when clicking outside
const handleClickOutside = (event: Event) => {
  const target = event.target as Element
  if (!target.closest('.user-dropdown') && !target.closest('.dropdown-menu')) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.user-menu {
  position: relative;
}

.auth-buttons {
  display: flex;
  gap: 12px;
}

.login-btn {
  background: #5865f2;
  color: white;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s ease;
}

.login-btn:hover {
  background: #4752c4;
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.user-dropdown:hover {
  background: rgba(255, 255, 255, 0.2);
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.user-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #5865f2;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.username {
  color: white;
  font-weight: 500;
  font-size: 14px;
}

.dropdown-arrow {
  width: 16px;
  height: 16px;
  color: white;
  transition: transform 0.2s ease;
}

.dropdown-arrow.rotate {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  min-width: 200px;
  z-index: 50;
  overflow: hidden;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  transition: background 0.2s ease;
}

.dropdown-item:hover:not(.user-details) {
  background: #f3f4f6;
}

.user-details {
  cursor: default;
  background: #f9fafb;
}

.user-name {
  font-weight: 600;
  color: #1f2937;
}

.user-id {
  font-size: 12px;
  color: #6b7280;
}

.user-role {
  font-size: 11px;
  color: #059669;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.dropdown-divider {
  margin: 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #dc2626;
  font-size: 14px;
}

.admin-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #059669;
  font-size: 14px;
  text-decoration: none;
  font-weight: 500;
}

.admin-link:hover {
  background-color: #f0fdf4;
}

.admin-icon {
  width: 16px;
  height: 16px;
}

.logout-icon {
  width: 16px;
  height: 16px;
}

.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 40;
}
</style>
