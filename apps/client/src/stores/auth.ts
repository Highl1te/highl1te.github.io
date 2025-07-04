import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export interface User {
  id: number
  discord_id: string
  username: string
  discriminator?: string
  avatar?: string
  role?: 'user' | 'moderator' | 'admin'
  is_banned?: boolean
  banned_until?: string
  ban_reason?: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'moderator')
  const avatarUrl = computed(() => {
    if (!user.value) return null
    if (!user.value.avatar) return null
    return `https://cdn.discordapp.com/avatars/${user.value.discord_id}/${user.value.avatar}.png`
  })

  // Set up axios to always include credentials for session-based auth
  axios.interceptors.request.use((config) => {
    config.withCredentials = true
    return config
  })

  const clearAuth = () => {
    user.value = null
  }

  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`)
      user.value = response.data.user
      return true
    } catch (error: any) {
      if (error.response?.status === 401) {
        clearAuth()
        return false
      }
      // Log non-401 errors as they might indicate server issues
      console.error('Error checking auth status:', error)
      return false
    }
  }

  const fetchUser = async () => {
    try {
      loading.value = true
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`)
      user.value = response.data.user
    } catch (error: any) {
      // Only log errors that aren't 401 (unauthorized) since that's expected when not logged in
      if (error.response?.status !== 401) {
        console.error('Failed to fetch user:', error)
      }
      clearAuth()
    } finally {
      loading.value = false
    }
  }

  const login = () => {
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/api/auth/discord`
    }
  }

  const logout = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/logout`)
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuth()
    }
  }

  const handleAuthCallback = async () => {
    await fetchUser()
  }

  // Try to fetch user on store initialization (in case session exists)
  // Don't await this to avoid blocking store initialization
  checkAuthStatus().catch(() => {
    // Silently handle any initialization errors - user can manually login
  })

  return {
    user,
    loading,
    isAuthenticated,
    isAdmin,
    avatarUrl,
    clearAuth,
    checkAuthStatus,
    fetchUser,
    login,
    logout,
    handleAuthCallback
  }
})
