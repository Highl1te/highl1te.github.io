<template>
  <div class="admin-dashboard">
    <div class="admin-header">
      <div class="header-left">
        <h1>
          <Icon icon="mdi:shield-account" class="admin-icon" />
          Admin Dashboard
        </h1>
        <div class="admin-role-badge">
          <Icon icon="mdi:shield-star" />
          {{ authStore.user?.role?.toUpperCase() }}
        </div>
      </div>
      <div class="header-actions">
        <button @click="refreshAllData" :disabled="loading" class="refresh-btn">
          <Icon icon="mdi:refresh" :class="{ 'spin': loading }" />
          Refresh
        </button>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <Icon icon="mdi:account-group" class="stat-icon" />
          <h3>Total Users</h3>
        </div>
        <div class="stat-value">{{ dashboardData?.statistics?.totalUsers || 0 }}</div>
        <div class="stat-change">+{{ recentUserGrowth }} this month</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <Icon icon="mdi:package-variant" class="stat-icon" />
          <h3>Active Listings</h3>
        </div>
        <div class="stat-value">{{ dashboardData?.statistics?.activeListings || 0 }}</div>
        <div class="stat-change">of {{ dashboardData?.statistics?.totalListings || 0 }} total</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <Icon icon="mdi:handshake" class="stat-icon" />
          <h3>Completed Trades</h3>
        </div>
        <div class="stat-value">{{ dashboardData?.statistics?.totalTrades || 0 }}</div>
        <div class="stat-change">{{ dashboardData?.statistics?.pendingTrades || 0 }} pending</div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <Icon icon="mdi:email" class="stat-icon" />
          <h3>Total Offers</h3>
        </div>
        <div class="stat-value">{{ dashboardData?.statistics?.totalOffers || 0 }}</div>
        <div class="stat-change">All time</div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="admin-tabs">
      <button 
        v-for="tab in adminTabs" 
        :key="tab.key"
        @click="activeTab = tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
      >
        <Icon :icon="tab.icon" />
        {{ tab.label }}
        <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
      </button>
    </div>

    <!-- Dashboard Overview -->
    <div v-if="activeTab === 'overview'" class="admin-section">
      <div class="section-grid">
        <!-- Recent Activity -->
        <div class="activity-section">
          <h3>
            <Icon icon="mdi:clock-outline" />
            Recent Activity
          </h3>
          <div class="activity-list">
            <div v-for="listing in dashboardData?.recentActivity?.recentListings?.slice(0, 5)" 
                 :key="listing.id" 
                 class="activity-item">
              <div class="activity-icon">
                <Icon icon="mdi:package-variant" />
              </div>
              <div class="activity-content">
                <div class="activity-title">New listing created</div>
                <div class="activity-meta">
                  by {{ listing.username }} • {{ formatDate(listing.created_at) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Analytics Charts -->
        <div class="charts-section">
          <h3>
            <Icon icon="mdi:chart-line" />
            Analytics
          </h3>
          <div class="chart-container">
            <div class="chart-placeholder">
              <Icon icon="mdi:chart-areaspline" />
              <p>User Growth & Trade Volume</p>
              <p class="chart-note">{{ dashboardData?.analytics?.userGrowth?.length || 0 }} data points</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Most Active Users -->
      <div class="most-active-section">
        <h3>
          <Icon icon="mdi:account-star" />
          Most Active Users
        </h3>
        <div class="users-grid">
          <div v-for="user in dashboardData?.analytics?.mostActiveUsers?.slice(0, 6)" 
               :key="user.username" 
               class="user-card">
            <div class="user-avatar">
              <img 
                :src="getDiscordAvatarUrl(user.discord_id)" 
                :alt="user.username"
                @error="(e) => (e.target as HTMLImageElement).src = getDiscordAvatarUrl(user.discord_id)"
              />
            </div>
            <div class="user-info">
              <h4>{{ user.username }}</h4>
              <div class="user-stats">
                <span>{{ user.listings_count }} listings</span>
                <span>{{ user.offers_count }} offers</span>
                <span>{{ user.completed_trades }} trades</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Users Management -->
    <div v-if="activeTab === 'users'" class="admin-section">
      <div class="section-header">
        <h3>
          <Icon icon="mdi:account-group" />
          Users Management
        </h3>
        <div class="section-actions">
          <div class="search-container">
            <Icon icon="mdi:magnify" class="search-icon" />
            <input 
              v-model="userSearchQuery" 
              placeholder="Search users..." 
              class="search-input"
              @input="searchUsers"
            />
          </div>
        </div>
      </div>

      <div class="users-table">
        <div class="table-header">
          <div class="table-cell">User</div>
          <div class="table-cell">Role</div>
          <div class="table-cell">Activity</div>
          <div class="table-cell">Status</div>
          <div class="table-cell">Actions</div>
        </div>
        
        <div v-for="user in users" :key="user.id" class="table-row">
          <div class="table-cell user-cell">
            <div class="user-avatar">
              <img 
                :src="getDiscordAvatarUrl(user.discord_id, user.avatar)" 
                :alt="user.username"
                @error="(e) => (e.target as HTMLImageElement).src = getDiscordAvatarUrl(user.discord_id)"
              />
            </div>
            <div class="user-details">
              <h4>{{ user.username }}</h4>
              <p>#{{ user.discriminator }}</p>
              <p class="user-date">Joined {{ formatDate(user.created_at) }}</p>
            </div>
          </div>
          
          <div class="table-cell">
            <select 
              v-model="user.role" 
              @change="updateUserRole(user.id, user.role)"
              class="role-select"
              :class="user.role"
            >
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          
          <div class="table-cell">
            <div class="activity-stats">
              <span class="stat-item">{{ user.listings_count }} listings</span>
              <span class="stat-item">{{ user.offers_count }} offers</span>
              <span v-if="user.warnings_count > 0" class="stat-item warning">
                {{ user.warnings_count }} warnings
              </span>
            </div>
          </div>
          
          <div class="table-cell">
            <div class="user-status">
              <span v-if="user.is_banned" class="status-badge banned">
                <Icon icon="mdi:block-helper" />
                Banned
              </span>
              <span v-else class="status-badge active">
                <Icon icon="mdi:check-circle" />
                Active
              </span>
            </div>
          </div>
          
          <div class="table-cell">
            <div class="user-actions">
              <button 
                @click="viewUserDetails(user.id)"
                class="btn btn-sm btn-secondary"
                title="View Details"
              >
                <Icon icon="mdi:eye" />
              </button>
              
              <button 
                @click="showWarnModal(user)"
                class="btn btn-sm btn-warning"
                title="Warn User"
              >
                <Icon icon="mdi:alert" />
              </button>
              
              <button 
                v-if="!user.is_banned"
                @click="showBanModal(user)"
                class="btn btn-sm btn-danger"
                title="Ban User"
              >
                <Icon icon="mdi:gavel" />
              </button>
              
              <button 
                v-else
                @click="unbanUser(user.id)"
                class="btn btn-sm btn-success"
                title="Unban User"
              >
                <Icon icon="mdi:check" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="usersPagination" class="pagination">
        <button 
          @click="loadUsers(usersPagination.current - 1)"
          :disabled="usersPagination.current <= 1"
          class="btn btn-secondary"
        >
          <Icon icon="mdi:chevron-left" />
          Previous
        </button>
        
        <span class="pagination-info">
          Page {{ usersPagination.current }} of {{ usersPagination.total }}
          ({{ usersPagination.count }} total users)
        </span>
        
        <button 
          @click="loadUsers(usersPagination.current + 1)"
          :disabled="usersPagination.current >= usersPagination.total"
          class="btn btn-secondary"
        >
          Next
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>
    </div>

    <!-- Listings Management -->
    <div v-if="activeTab === 'listings'" class="admin-section">
      <div class="section-header">
        <h3>
          <Icon icon="mdi:package-variant" />
          Listings Management
        </h3>
        <div class="section-actions">
          <select v-model="listingStatusFilter" @change="() => loadListings()" class="filter-select">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="closed">Closed</option>
            <option value="removed">Removed</option>
          </select>
        </div>
      </div>

      <div class="listings-table">
        <div class="table-header">
          <div class="table-cell">Listing</div>
          <div class="table-cell">Seller</div>
          <div class="table-cell">Status</div>
          <div class="table-cell">Offers</div>
          <div class="table-cell">Actions</div>
        </div>
        
        <div v-for="listing in listings" :key="listing.id" class="table-row">
          <div class="table-cell listing-cell">
            <div class="listing-info">
              <h4>{{ getItemName(listing.item_id) }}</h4>
              <p>{{ listing.quantity }}x - {{ listing.asking_price }} coins</p>
              <p class="listing-date">{{ formatDate(listing.created_at) }}</p>
            </div>
          </div>
          
          <div class="table-cell">
            <div class="seller-info">
              <div class="user-avatar">
                <img 
                  :src="getDiscordAvatarUrl(listing.discord_id)" 
                  :alt="listing.username"
                  @error="(e) => (e.target as HTMLImageElement).src = getDiscordAvatarUrl(listing.discord_id)"
                />
              </div>
              <span>{{ listing.username }}</span>
            </div>
          </div>
          
          <div class="table-cell">
            <span class="status-badge" :class="listing.status">
              {{ listing.status }}
            </span>
          </div>
          
          <div class="table-cell">
            <span class="offers-count">{{ listing.offers_count }}</span>
          </div>
          
          <div class="table-cell">
            <div class="listing-actions">
              <button 
                v-if="listing.status === 'active'"
                @click="showCloseListingModal(listing)"
                class="btn btn-sm btn-danger"
                title="Close Listing"
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="listingsPagination" class="pagination">
        <button 
          @click="loadListings(listingsPagination.current - 1)"
          :disabled="listingsPagination.current <= 1"
          class="btn btn-secondary"
        >
          <Icon icon="mdi:chevron-left" />
          Previous
        </button>
        
        <span class="pagination-info">
          Page {{ listingsPagination.current }} of {{ listingsPagination.total }}
          ({{ listingsPagination.count }} total listings)
        </span>
        
        <button 
          @click="loadListings(listingsPagination.current + 1)"
          :disabled="listingsPagination.current >= listingsPagination.total"
          class="btn btn-secondary"
        >
          Next
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>
    </div>

    <!-- Trades Management -->
    <div v-if="activeTab === 'trades'" class="admin-section">
      <div class="section-header">
        <h3>
          <Icon icon="mdi:handshake" />
          Trades Management
        </h3>
      </div>

      <div class="trades-table">
        <div class="table-header">
          <div class="table-cell">Trade</div>
          <div class="table-cell">Participants</div>
          <div class="table-cell">Status</div>
          <div class="table-cell">Date</div>
          <div class="table-cell">Actions</div>
        </div>
        
        <div v-for="trade in trades" :key="trade.id" class="table-row">
          <div class="table-cell trade-cell">
            <div class="trade-info">
              <h4>{{ getItemName(trade.item_id) }}</h4>
              <p>{{ trade.quantity }}x - {{ trade.asking_price }} coins</p>
              <p v-if="trade.coin_offer">Offer: {{ trade.coin_offer }} coins</p>
            </div>
          </div>
          
          <div class="table-cell">
            <div class="trade-participants">
              <div class="participant">
                <div class="user-avatar">
                  <img 
                    :src="getDiscordAvatarUrl(trade.seller_discord_id)" 
                    :alt="trade.seller_name"
                    @error="(e) => (e.target as HTMLImageElement).src = getDiscordAvatarUrl(trade.seller_discord_id)"
                  />
                </div>
                <span>{{ trade.seller_name }}</span>
              </div>
              <Icon icon="mdi:arrow-right" />
              <div class="participant">
                <div class="user-avatar">
                  <img 
                    :src="getDiscordAvatarUrl(trade.buyer_discord_id)" 
                    :alt="trade.buyer_name"
                    @error="(e) => (e.target as HTMLImageElement).src = getDiscordAvatarUrl(trade.buyer_discord_id)"
                  />
                </div>
                <span>{{ trade.buyer_name }}</span>
              </div>
            </div>
          </div>
          
          <div class="table-cell">
            <span class="status-badge" :class="trade.status">
              {{ trade.status }}
            </span>
          </div>
          
          <div class="table-cell">
            <span class="trade-date">{{ formatDate(trade.created_at) }}</span>
          </div>
          
          <div class="table-cell">
            <div class="trade-actions">
              <button 
                v-if="trade.status === 'pending'"
                @click="showForceCloseTradeModal(trade)"
                class="btn btn-sm btn-danger"
                title="Force Close Trade"
              >
                <Icon icon="mdi:close-circle" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="tradesPagination" class="pagination">
        <button 
          @click="loadTrades(tradesPagination.current - 1)"
          :disabled="tradesPagination.current <= 1"
          class="btn btn-secondary"
        >
          <Icon icon="mdi:chevron-left" />
          Previous
        </button>
        
        <span class="pagination-info">
          Page {{ tradesPagination.current }} of {{ tradesPagination.total }}
          ({{ tradesPagination.count }} total trades)
        </span>
        
        <button 
          @click="loadTrades(tradesPagination.current + 1)"
          :disabled="tradesPagination.current >= tradesPagination.total"
          class="btn btn-secondary"
        >
          Next
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>
    </div>

    <!-- Admin Actions Log -->
    <div v-if="activeTab === 'actions'" class="admin-section">
      <div class="section-header">
        <h3>
          <Icon icon="mdi:history" />
          Admin Actions Log
        </h3>
      </div>

      <div class="actions-table">
        <div class="table-header">
          <div class="table-cell">Action</div>
          <div class="table-cell">Admin</div>
          <div class="table-cell">Target</div>
          <div class="table-cell">Details</div>
          <div class="table-cell">Date</div>
        </div>
        
        <div v-for="action in adminActions" :key="action.id" class="table-row">
          <div class="table-cell">
            <div class="action-type">
              <Icon :icon="getActionIcon(action.action_type)" />
              {{ formatActionType(action.action_type) }}
            </div>
          </div>
          
          <div class="table-cell">
            <span>{{ action.admin_name }}</span>
          </div>
          
          <div class="table-cell">
            <span>{{ action.target_type }} #{{ action.target_id }}</span>
          </div>
          
          <div class="table-cell">
            <span class="action-details">{{ formatActionDetails(action.details) }}</span>
          </div>
          
          <div class="table-cell">
            <span class="action-date">{{ formatDate(action.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="actionsPagination" class="pagination">
        <button 
          @click="loadAdminActions(actionsPagination.current - 1)"
          :disabled="actionsPagination.current <= 1"
          class="btn btn-secondary"
        >
          <Icon icon="mdi:chevron-left" />
          Previous
        </button>
        
        <span class="pagination-info">
          Page {{ actionsPagination.current }} of {{ actionsPagination.total }}
          ({{ actionsPagination.count }} total actions)
        </span>
        
        <button 
          @click="loadAdminActions(actionsPagination.current + 1)"
          :disabled="actionsPagination.current >= actionsPagination.total"
          class="btn btn-secondary"
        >
          Next
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>
    </div>

    <!-- Ban User Modal -->
    <div v-if="showBanUserModal" class="modal-overlay" @click="showBanUserModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Ban User</h2>
          <button @click="showBanUserModal = false" class="close-btn">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="modal-body">
          <div class="user-info">
            <div class="user-avatar">
              <img 
                :src="getDiscordAvatarUrl(selectedUser?.discord_id, selectedUser?.avatar)" 
                :alt="selectedUser?.username"
                @error="(e) => (e.target as HTMLImageElement).src = getDiscordAvatarUrl(selectedUser?.discord_id)"
              />
            </div>
            <div class="user-details">
              <h3>{{ selectedUser?.username }}</h3>
              <p>#{{ selectedUser?.discriminator }}</p>
            </div>
          </div>

          <div class="form-group">
            <label>Ban Reason:</label>
            <textarea 
              v-model="banForm.reason" 
              placeholder="Enter reason for ban..."
              class="form-control"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label>Ban Duration:</label>
            <select v-model="banForm.duration" class="form-control">
              <option :value="null">Permanent</option>
              <option :value="1">1 Hour</option>
              <option :value="24">24 Hours</option>
              <option :value="168">1 Week</option>
              <option :value="720">1 Month</option>
            </select>
          </div>

          <div class="modal-actions">
            <button @click="showBanUserModal = false" class="btn btn-secondary">Cancel</button>
            <button @click="banUser" class="btn btn-danger">Ban User</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Warn User Modal -->
    <div v-if="showWarnUserModal" class="modal-overlay" @click="showWarnUserModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Issue Warning</h2>
          <button @click="showWarnUserModal = false" class="close-btn">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="modal-body">
          <div class="user-info">
            <div class="user-avatar">
              <img 
                :src="getDiscordAvatarUrl(selectedUser?.discord_id, selectedUser?.avatar)" 
                :alt="selectedUser?.username"
                @error="(e) => (e.target as HTMLImageElement).src = getDiscordAvatarUrl(selectedUser?.discord_id)"
              />
            </div>
            <div class="user-details">
              <h3>{{ selectedUser?.username }}</h3>
              <p>#{{ selectedUser?.discriminator }}</p>
            </div>
          </div>

          <div class="form-group">
            <label>Warning Type:</label>
            <select v-model="warnForm.warning_type" class="form-control">
              <option value="behavior">Inappropriate Behavior</option>
              <option value="spam">Spam/Flooding</option>
              <option value="scam">Scam Attempt</option>
              <option value="terms">Terms Violation</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label>Warning Message:</label>
            <textarea 
              v-model="warnForm.message" 
              placeholder="Enter warning message..."
              class="form-control"
              rows="3"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button @click="showWarnUserModal = false" class="btn btn-secondary">Cancel</button>
            <button @click="warnUser" class="btn btn-warning">Issue Warning</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Close Listing Modal -->
    <div v-if="showCloseListingModalRef" class="modal-overlay" @click="showCloseListingModalRef = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Close Listing</h2>
          <button @click="showCloseListingModalRef = false" class="close-btn">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="modal-body">
          <div class="listing-info">
            <h3>{{ getItemName(selectedListing?.item_id) }}</h3>
            <p>{{ selectedListing?.quantity }}x - {{ selectedListing?.asking_price }} coins</p>
            <p>by {{ selectedListing?.username }}</p>
          </div>

          <div class="form-group">
            <label>Reason for closing:</label>
            <textarea 
              v-model="closeListingForm.reason" 
              placeholder="Enter reason for closing listing..."
              class="form-control"
              rows="3"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button @click="showCloseListingModalRef = false" class="btn btn-secondary">Cancel</button>
            <button @click="closeListing" class="btn btn-danger">Close Listing</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Force Close Trade Modal -->
    <div v-if="showForceCloseTradeModalRef" class="modal-overlay" @click="showForceCloseTradeModalRef = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>Force Close Trade</h2>
          <button @click="showForceCloseTradeModalRef = false" class="close-btn">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="modal-body">
          <div class="trade-info">
            <h3>{{ getItemName(selectedTrade?.item_id) }}</h3>
            <p>{{ selectedTrade?.quantity }}x - {{ selectedTrade?.asking_price }} coins</p>
            <p>{{ selectedTrade?.seller_name }} → {{ selectedTrade?.buyer_name }}</p>
          </div>

          <div class="form-group">
            <label>Reason for closing:</label>
            <textarea 
              v-model="forceCloseTradeForm.reason" 
              placeholder="Enter reason for force closing trade..."
              class="form-control"
              rows="3"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button @click="showForceCloseTradeModalRef = false" class="btn btn-secondary">Cancel</button>
            <button @click="forceCloseTrade" class="btn btn-danger">Force Close Trade</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'
import itemDefs from '@/assets/marketplace/itemdefs.json'

const authStore = useAuthStore()
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// State
const activeTab = ref('overview')
const dashboardData = ref<any>(null)
const users = ref<any[]>([])
const listings = ref<any[]>([])
const trades = ref<any[]>([])
const adminActions = ref<any[]>([])
const loading = ref(false)

// Pagination
const usersPagination = ref<any>(null)
const listingsPagination = ref<any>(null)
const tradesPagination = ref<any>(null)
const actionsPagination = ref<any>(null)

// Filters
const userSearchQuery = ref('')
const listingStatusFilter = ref('')

// Modals
const showBanUserModal = ref(false)
const showWarnUserModal = ref(false)
const showCloseListingModalRef = ref(false)
const showForceCloseTradeModalRef = ref(false)

// Selected items
const selectedUser = ref<any>(null)
const selectedListing = ref<any>(null)
const selectedTrade = ref<any>(null)

// Forms
const banForm = ref({
  reason: '',
  duration: null as number | null
})

const warnForm = ref({
  warning_type: 'behavior',
  message: ''
})

const closeListingForm = ref({
  reason: ''
})

const forceCloseTradeForm = ref({
  reason: ''
})

// Computed
const adminTabs = computed(() => [
  { 
    key: 'overview', 
    label: 'Overview', 
    icon: 'mdi:view-dashboard' 
  },
  { 
    key: 'users', 
    label: 'Users', 
    icon: 'mdi:account-group',
    badge: users.value.length
  },
  { 
    key: 'listings', 
    label: 'Listings', 
    icon: 'mdi:package-variant',
    badge: listings.value.length
  },
  { 
    key: 'trades', 
    label: 'Trades', 
    icon: 'mdi:handshake',
    badge: trades.value.length
  },
  { 
    key: 'actions', 
    label: 'Actions Log', 
    icon: 'mdi:history',
    badge: adminActions.value.length
  }
])

const recentUserGrowth = computed(() => {
  if (!dashboardData.value?.analytics?.userGrowth) return 0
  return dashboardData.value.analytics.userGrowth.reduce((sum: number, day: any) => sum + day.count, 0)
})

// Methods
const loadDashboard = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/admin/dashboard`)
    dashboardData.value = response.data
  } catch (error) {
    console.error('Error loading dashboard:', error)
  }
}

const loadUsers = async (page: number = 1) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/admin/users`, {
      params: { page, search: userSearchQuery.value }
    })
    users.value = response.data.users
    usersPagination.value = response.data.pagination
  } catch (error) {
    console.error('Error loading users:', error)
  }
}

const loadListings = async (page: number = 1) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/admin/listings`, {
      params: { page, status: listingStatusFilter.value }
    })
    listings.value = response.data.listings
    listingsPagination.value = response.data.pagination
  } catch (error) {
    console.error('Error loading listings:', error)
  }
}

const loadTrades = async (page: number = 1) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/admin/trades`, {
      params: { page }
    })
    trades.value = response.data.trades
    tradesPagination.value = response.data.pagination
  } catch (error) {
    console.error('Error loading trades:', error)
  }
}

const loadAdminActions = async (page: number = 1) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/admin/actions`, {
      params: { page }
    })
    adminActions.value = response.data.actions
    actionsPagination.value = response.data.pagination
  } catch (error) {
    console.error('Error loading admin actions:', error)
  }
}

const refreshAllData = async () => {
  loading.value = true
  try {
    await Promise.all([
      loadDashboard(),
      loadUsers(),
      loadListings(),
      loadTrades(),
      loadAdminActions()
    ])
  } catch (error) {
    console.error('Error refreshing data:', error)
  } finally {
    loading.value = false
  }
}

const searchUsers = () => {
  loadUsers(1)
}

const updateUserRole = async (userId: number, role: string) => {
  try {
    await axios.put(`${API_BASE_URL}/api/admin/users/${userId}/role`, { role })
    // Refresh users list
    loadUsers(usersPagination.value?.current || 1)
  } catch (error) {
    console.error('Error updating user role:', error)
  }
}

const showBanModal = (user: any) => {
  selectedUser.value = user
  banForm.value = { reason: '', duration: null }
  showBanUserModal.value = true
}

const showWarnModal = (user: any) => {
  selectedUser.value = user
  warnForm.value = { warning_type: 'behavior', message: '' }
  showWarnUserModal.value = true
}

const showCloseListingModal = (listing: any) => {
  selectedListing.value = listing
  closeListingForm.value = { reason: '' }
  showCloseListingModalRef.value = true
}

const showForceCloseTradeModal = (trade: any) => {
  selectedTrade.value = trade
  forceCloseTradeForm.value = { reason: '' }
  showForceCloseTradeModalRef.value = true
}

const banUser = async () => {
  if (!selectedUser.value) return
  
  try {
    await axios.post(`${API_BASE_URL}/api/admin/users/${selectedUser.value.id}/ban`, banForm.value)
    showBanUserModal.value = false
    loadUsers(usersPagination.value?.current || 1)
  } catch (error) {
    console.error('Error banning user:', error)
  }
}

const unbanUser = async (userId: number) => {
  try {
    await axios.post(`${API_BASE_URL}/api/admin/users/${userId}/unban`)
    loadUsers(usersPagination.value?.current || 1)
  } catch (error) {
    console.error('Error unbanning user:', error)
  }
}

const warnUser = async () => {
  if (!selectedUser.value) return
  
  try {
    await axios.post(`${API_BASE_URL}/api/admin/users/${selectedUser.value.id}/warn`, warnForm.value)
    showWarnUserModal.value = false
    loadUsers(usersPagination.value?.current || 1)
  } catch (error) {
    console.error('Error warning user:', error)
  }
}

const closeListing = async () => {
  if (!selectedListing.value) return
  
  try {
    await axios.post(`${API_BASE_URL}/api/admin/listings/${selectedListing.value.id}/close`, closeListingForm.value)
    showCloseListingModalRef.value = false
    loadListings(listingsPagination.value?.current || 1)
  } catch (error) {
    console.error('Error closing listing:', error)
  }
}

const forceCloseTrade = async () => {
  if (!selectedTrade.value) return
  
  try {
    await axios.post(`${API_BASE_URL}/api/admin/trades/${selectedTrade.value.id}/force-close`, forceCloseTradeForm.value)
    showForceCloseTradeModalRef.value = false
    loadTrades(tradesPagination.value?.current || 1)
  } catch (error) {
    console.error('Error force closing trade:', error)
  }
}

const viewUserDetails = (userId: number) => {
  // TODO: Implement user details view
  console.log('View user details:', userId)
}

// Utility functions
const getDiscordAvatarUrl = (discordId: string, avatar?: string) => {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`
  }
  return `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`
}

const getItemName = (itemId: number): string => {
  const item = (itemDefs as any[]).find(item => item._id === itemId)
  if (!item) return 'Unknown Item'
  
  return item.name
    .split(' ')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getActionIcon = (actionType: string): string => {
  const icons: { [key: string]: string } = {
    'ban_user': 'mdi:gavel',
    'unban_user': 'mdi:check-circle',
    'warn_user': 'mdi:alert',
    'role_change': 'mdi:shield-account',
    'close_listing': 'mdi:close-circle',
    'force_close_trade': 'mdi:close-circle-outline'
  }
  return icons[actionType] || 'mdi:information'
}

const formatActionType = (actionType: string): string => {
  return actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatActionDetails = (details: string): string => {
  try {
    const parsed = JSON.parse(details)
    return Object.entries(parsed).map(([key, value]) => `${key}: ${value}`).join(', ')
  } catch {
    return details
  }
}

// Lifecycle
onMounted(() => {
  loadDashboard()
  loadUsers()
  loadListings()
  loadTrades()
  loadAdminActions()
})
</script>

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  background: var(--theme-background);
  color: var(--theme-text);
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 24px;
  background: var(--theme-background-soft);
  border-radius: 12px;
  border: 1px solid var(--theme-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  background: var(--theme-accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--theme-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn .spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.admin-header h1 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--theme-text);
}

.admin-icon {
  font-size: 2.5rem;
  color: var(--theme-accent);
}

.admin-role-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: var(--theme-accent);
  color: white;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 30px;
}

.stat-card {
  background: var(--theme-background-soft);
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border-color: var(--theme-accent);
}

.stat-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--theme-text);
}

.stat-icon {
  font-size: 2rem;
  color: var(--theme-accent);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--theme-text);
  margin-bottom: 8px;
}

.stat-change {
  font-size: 0.9rem;
  color: var(--theme-text-muted);
  font-weight: 500;
}

.stat-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--theme-text-muted);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--theme-text);
  margin-bottom: 5px;
}

.stat-change {
  font-size: 0.9rem;
  color: var(--theme-text-muted);
}

.admin-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 30px;
  background: var(--theme-background-soft);
  border-radius: 12px;
  padding: 8px;
  border: 1px solid var(--theme-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--theme-background);
  border: 1px solid var(--theme-border);
  color: var(--theme-text);
  cursor: pointer;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s ease;
  position: relative;
}

.tab-btn:hover {
  background: var(--theme-background-soft);
  border-color: var(--theme-accent);
  color: var(--theme-text);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tab-btn.active {
  background: var(--theme-accent);
  color: white !important;
  border-color: var(--theme-accent);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.tab-badge {
  background: var(--theme-accent);
  color: white;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.tab-btn.active .tab-badge {
  background: rgba(255, 255, 255, 0.3) !important;
  color: white !important;
}

.tab-btn:not(.active) .tab-badge {
  background: var(--theme-accent);
  color: white;
}

.admin-section {
  background: var(--theme-background-soft);
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--theme-border);
}

.section-header h3 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--theme-text);
}

.section-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-container {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--theme-text-muted);
}

.search-input {
  padding: 10px 12px 10px 36px;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  background: var(--theme-background);
  color: var(--theme-text);
  width: 280px;
  font-size: 0.95rem;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--theme-accent);
  box-shadow: 0 0 0 3px rgba(var(--theme-accent-rgb), 0.1);
}

.filter-select {
  padding: 10px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  background: var(--theme-background);
  color: var(--theme-text);
  font-size: 0.95rem;
  transition: all 0.2s ease;
}

.filter-select:focus {
  outline: none;
  border-color: var(--theme-accent);
  box-shadow: 0 0 0 3px rgba(var(--theme-accent-rgb), 0.1);
}

.section-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.activity-section h3,
.charts-section h3 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--theme-text);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--theme-background);
  border-radius: 8px;
  border: 1px solid var(--theme-border);
  transition: all 0.2s ease;
}

.activity-item:hover {
  background: var(--theme-background-soft);
  border-color: var(--theme-accent);
}

.activity-icon {
  padding: 10px;
  background: var(--theme-accent);
  color: white;
  border-radius: 50%;
  font-size: 1.2rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-weight: 600;
  color: var(--theme-text);
  margin-bottom: 4px;
  font-size: 1rem;
}

.activity-meta {
  font-size: 0.9rem;
  color: var(--theme-text-muted);
  font-weight: 500;
}

.chart-container {
  height: 200px;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-background);
}

.chart-placeholder {
  text-align: center;
  color: var(--theme-text-muted);
}

.chart-placeholder Icon {
  font-size: 3rem;
  margin-bottom: 10px;
}

.chart-note {
  font-size: 0.9rem;
  margin-top: 5px;
}

.most-active-section h3 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--theme-text);
}

.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--theme-background);
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.user-card:hover {
  background: var(--theme-background-soft);
  border-color: var(--theme-accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.user-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid var(--theme-border);
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-info {
  flex: 1;
}

.user-info h4 {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--theme-text);
}

.user-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-stats span {
  font-size: 0.9rem;
  color: var(--theme-text-muted);
  font-weight: 500;
  padding: 2px 8px;
  background: var(--theme-background-soft);
  border-radius: 4px;
  width: fit-content;
}

.users-table,
.listings-table,
.trades-table,
.actions-table {
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
  background: var(--theme-background);
  border-bottom: 1px solid var(--theme-border);
}

.table-header .table-cell {
  padding: 16px;
  font-weight: 600;
  color: var(--theme-text);
  border-right: 1px solid var(--theme-border);
}

.table-header .table-cell:last-child {
  border-right: none;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
  border-bottom: 1px solid var(--theme-border);
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--theme-background);
}

.table-cell {
  padding: 16px;
  border-right: 1px solid var(--theme-border);
  display: flex;
  align-items: center;
  font-size: 0.95rem;
}

.table-cell:last-child {
  border-right: none;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-details h4 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--theme-text);
}

.user-details p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--theme-text-muted);
  font-weight: 500;
}

.user-date {
  font-size: 0.8rem !important;
}

.role-select {
  padding: 8px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  background: var(--theme-background);
  color: var(--theme-text);
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.role-select:focus {
  outline: none;
  border-color: var(--theme-accent);
  box-shadow: 0 0 0 3px rgba(var(--theme-accent-rgb), 0.1);
}

.role-select.admin {
  background: var(--theme-accent);
  color: white;
  font-weight: 600;
}

.role-select.moderator {
  background: #f59e0b !important;
  color: #1f2937 !important;
  font-weight: 600;
}

.role-select.user {
  background: var(--theme-background-soft);
  color: var(--theme-text);
}

.activity-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-item {
  font-size: 0.9rem;
  color: var(--theme-text-muted);
  font-weight: 500;
  padding: 2px 8px;
  background: var(--theme-background-soft);
  border-radius: 4px;
  width: fit-content;
}

.stat-item.warning {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #b45309 !important;
  font-weight: 600;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
}

.status-badge.active {
  background: rgba(34, 197, 94, 0.2);
  color: rgb(34, 197, 94);
}

.status-badge.banned {
  background: rgba(239, 68, 68, 0.2);
  color: rgb(239, 68, 68);
}

.status-badge.pending {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #b45309 !important;
}

.status-badge.completed {
  background: rgba(34, 197, 94, 0.2);
  color: rgb(34, 197, 94);
}

.status-badge.cancelled {
  background: rgba(156, 163, 175, 0.2);
  color: rgb(156, 163, 175);
}

.user-actions,
.listing-actions,
.trade-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn:active {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.btn-lg {
  padding: 12px 24px;
  font-size: 1rem;
}

.btn-primary {
  background: var(--theme-accent);
  color: white;
  border-color: var(--theme-accent);
}

.btn-primary:hover:not(:disabled) {
  background: var(--theme-accent-hover);
  border-color: var(--theme-accent-hover);
}

.btn-secondary {
  background: var(--theme-background);
  color: var(--theme-text);
  border-color: var(--theme-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--theme-background-soft);
  border-color: var(--theme-accent);
}

.btn-success {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
}

.btn-warning {
  background: #f59e0b !important;
  color: #1f2937 !important;
  border-color: #f59e0b;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706 !important;
  color: #1f2937 !important;
  border-color: #d97706;
}

.btn-danger {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
}

.pagination-info {
  color: var(--theme-text-muted);
  font-size: 0.9rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--theme-background-soft);
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--theme-border);
}

.modal-header h2 {
  margin: 0;
  color: var(--theme-text);
}

.close-btn {
  background: none;
  border: none;
  color: var(--theme-text-muted);
  cursor: pointer;
  font-size: 1.5rem;
  padding: 4px;
}

.close-btn:hover {
  color: var(--theme-text);
}

.modal-body {
  padding: 20px;
}

.user-info,
.listing-info,
.trade-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--theme-background);
  border: 1px solid var(--theme-border);
  border-radius: 8px;
}

.user-info .user-avatar {
  width: 50px;
  height: 50px;
}

.user-details h3 {
  margin: 0 0 4px 0;
  color: var(--theme-text);
}

.user-details p {
  margin: 0;
  color: var(--theme-text-muted);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--theme-text);
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  background: var(--theme-background);
  color: var(--theme-text);
  font-size: 0.9rem;
}

.form-control:focus {
  outline: none;
  border-color: var(--theme-accent);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.listing-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.listing-info h4 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  color: var(--theme-text);
}

.listing-info p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--theme-text-muted);
}

.listing-date {
  font-size: 0.8rem !important;
}

.seller-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.seller-info .user-avatar {
  width: 30px;
  height: 30px;
}

.seller-info span {
  font-size: 0.9rem;
  color: var(--theme-text);
}

.offers-count {
  font-size: 0.9rem;
  color: var(--theme-text);
}

.trade-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trade-info h4 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  color: var(--theme-text);
}

.trade-info p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--theme-text-muted);
}

.trade-participants {
  display: flex;
  align-items: center;
  gap: 8px;
}

.participant {
  display: flex;
  align-items: center;
  gap: 6px;
}

.participant .user-avatar {
  width: 25px;
  height: 25px;
}

.participant span {
  font-size: 0.8rem;
  color: var(--theme-text);
}

.trade-date {
  font-size: 0.9rem;
  color: var(--theme-text-muted);
}

.action-type {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--theme-text);
}

.action-details {
  font-size: 0.8rem;
  color: var(--theme-text-muted);
}

.action-date {
  font-size: 0.9rem;
  color: var(--theme-text-muted);
}

@media (max-width: 1024px) {
  .section-grid {
    grid-template-columns: 1fr;
  }
  
  .users-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
}

@media (max-width: 768px) {
  .admin-header {
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }
  
  .admin-tabs {
    flex-wrap: wrap;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .table-header,
  .table-row {
    grid-template-columns: 1fr;
  }
  
  .table-header .table-cell,
  .table-cell {
    border-right: none;
    border-bottom: 1px solid var(--theme-border);
  }
  
  .table-cell:last-child {
    border-bottom: none;
  }
}
</style>
