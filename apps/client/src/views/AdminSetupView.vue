<template>
  <div class="admin-setup">
    <div class="container">
      <div class="header">
        <h1>🛠️ Admin Setup</h1>
        <p>Development tool for setting up admin access</p>
      </div>

      <div class="section">
        <h2>Authentication Status</h2>
        <div v-if="loading" class="loading">Checking authentication...</div>
        <div v-else-if="authStore.isAuthenticated" class="auth-info">
          <div class="success">
            ✅ <strong>Authenticated as:</strong> {{ authStore.user?.username }}#{{ authStore.user?.discriminator }}
          </div>
          <div class="role-info">
            <strong>Current Role:</strong> 
            <span :class="['role-badge', authStore.user?.role || 'user']">
              {{ authStore.user?.role || 'user' }}
            </span>
          </div>
          <div v-if="authStore.isAdmin" class="admin-notice">
            🎉 You already have admin access! 
            <router-link to="/admin" class="admin-link">Go to Admin Dashboard</router-link>
          </div>
        </div>
        <div v-else class="auth-warning">
          ⚠️ You need to log in first
          <router-link to="/login" class="login-link">Sign In with Discord</router-link>
        </div>
      </div>

      <div v-if="authStore.isAuthenticated && !authStore.isAdmin" class="section">
        <h2>Promote to Admin</h2>
        <div class="warning">
          <strong>⚠️ Development Only:</strong> This feature is only available in development mode.
        </div>
        <button 
          @click="promoteToAdmin" 
          :disabled="promoting"
          class="promote-btn"
        >
          {{ promoting ? 'Promoting...' : 'Make Me Admin' }}
        </button>
        <div v-if="promoteResult" class="result" :class="promoteResult.type">
          {{ promoteResult.message }}
        </div>
      </div>

      <div v-if="authStore.isAdmin" class="section">
        <h2>Admin Dashboard</h2>
        <div class="success">
          🎉 Admin access confirmed! You can now access the admin dashboard.
        </div>
        <div class="admin-actions">
          <router-link to="/admin" class="btn btn-primary">
            🏠 Go to Admin Dashboard
          </router-link>
          <button @click="testAdminAPI" class="btn btn-secondary">
            🧪 Test Admin API
          </button>
        </div>
        <div v-if="apiTestResult" class="result" :class="apiTestResult.type">
          {{ apiTestResult.message }}
        </div>
      </div>

      <div class="section">
        <h2>Debug Information</h2>
        <button @click="toggleDebug" class="btn btn-secondary">
          {{ showDebug ? 'Hide' : 'Show' }} Debug Info
        </button>
        <div v-if="showDebug" class="debug-info">
          <h3>User Data:</h3>
          <pre>{{ JSON.stringify(authStore.user, null, 2) }}</pre>
          <h3>Auth Store State:</h3>
          <pre>{{ JSON.stringify({ 
            isAuthenticated: authStore.isAuthenticated,
            isAdmin: authStore.isAdmin
          }, null, 2) }}</pre>
        </div>
      </div>

      <div class="section">
        <h2>Navigation</h2>
        <div class="nav-links">
          <router-link to="/" class="btn btn-secondary">🏠 Home</router-link>
          <router-link to="/marketplace" class="btn btn-secondary">🛒 Marketplace</router-link>
          <router-link v-if="authStore.isAdmin" to="/admin" class="btn btn-primary">⚙️ Admin Dashboard</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const loading = ref(true)
const promoting = ref(false)
const promoteResult = ref<{ type: string; message: string } | null>(null)
const apiTestResult = ref<{ type: string; message: string } | null>(null)
const showDebug = ref(false)

onMounted(async () => {
  // Refresh auth state
  try {
    await authStore.fetchUser()
  } catch (error) {
    console.error('Error fetching user:', error)
  } finally {
    loading.value = false
  }
})

const promoteToAdmin = async () => {
  promoting.value = true
  promoteResult.value = null
  
  try {
    const response = await fetch('/api/auth/promote-admin', {
      method: 'POST',
      credentials: 'include'
    })
    
    const data = await response.json()
    
    if (data.success) {
      promoteResult.value = {
        type: 'success',
        message: `✅ Success! You are now an admin. Refreshing...`
      }
      
      // Refresh auth state after successful promotion
      setTimeout(async () => {
        await authStore.fetchUser()
      }, 1000)
    } else {
      promoteResult.value = {
        type: 'error',
        message: `❌ Error: ${data.error || 'Unknown error'}`
      }
    }
  } catch (error) {
    promoteResult.value = {
      type: 'error',
      message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  } finally {
    promoting.value = false
  }
}

const testAdminAPI = async () => {
  apiTestResult.value = null
  
  try {
    const response = await fetch('/api/admin/stats', {
      credentials: 'include'
    })
    
    const data = await response.json()
    
    if (response.ok) {
      apiTestResult.value = {
        type: 'success',
        message: `✅ Admin API test successful! Found ${data.totalUsers || 0} users, ${data.totalListings || 0} listings.`
      }
    } else {
      apiTestResult.value = {
        type: 'error',
        message: `❌ Admin API test failed: ${data.error || 'Unknown error'}`
      }
    }
  } catch (error) {
    apiTestResult.value = {
      type: 'error',
      message: `❌ Admin API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

const toggleDebug = () => {
  showDebug.value = !showDebug.value
}
</script>

<style scoped>
.admin-setup {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 40px 30px;
  text-align: center;
}

.header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5em;
  font-weight: 700;
}

.header p {
  margin: 0;
  opacity: 0.9;
  font-size: 1.1em;
}

.section {
  padding: 30px;
  border-bottom: 1px solid #eee;
}

.section:last-child {
  border-bottom: none;
}

.section h2 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 1.5em;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.auth-info {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #28a745;
}

.success {
  color: #155724;
  background: #d4edda;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 15px;
}

.auth-warning {
  background: #fff3cd;
  color: #856404;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #ffc107;
  text-align: center;
}

.warning {
  background: #fff3cd;
  color: #856404;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 20px;
}

.role-info {
  margin-top: 10px;
}

.role-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.role-badge.user {
  background: #e9ecef;
  color: #495057;
}

.role-badge.admin {
  background: #ffc107;
  color: #212529;
}

.role-badge.moderator {
  background: #17a2b8;
  color: white;
}

.admin-notice {
  margin-top: 15px;
  padding: 15px;
  background: #d1ecf1;
  color: #0c5460;
  border-radius: 6px;
}

.promote-btn {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 8px;
  font-size: 1.1em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
}

.promote-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
}

.promote-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn {
  display: inline-block;
  padding: 12px 24px;
  margin: 8px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  font-size: 1em;
}

.btn-primary {
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.result {
  margin-top: 15px;
  padding: 12px;
  border-radius: 6px;
  font-weight: 500;
}

.result.success {
  color: #155724;
  background: #d4edda;
  border: 1px solid #c3e6cb;
}

.result.error {
  color: #721c24;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
}

.admin-actions {
  display: flex;
  gap: 15px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.debug-info {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-top: 15px;
}

.debug-info h3 {
  margin: 0 0 10px 0;
  color: #495057;
  font-size: 1.1em;
}

.debug-info pre {
  background: #e9ecef;
  padding: 15px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.9em;
  color: #495057;
}

.nav-links {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.login-link,
.admin-link {
  color: #007bff;
  text-decoration: none;
  font-weight: 600;
  margin-left: 10px;
}

.login-link:hover,
.admin-link:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .admin-setup {
    padding: 10px;
  }
  
  .header {
    padding: 30px 20px;
  }
  
  .section {
    padding: 20px;
  }
  
  .admin-actions {
    flex-direction: column;
  }
  
  .nav-links {
    flex-direction: column;
  }
}
</style>
